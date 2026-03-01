import { jest } from "@jest/globals";
import type {
  HealthCheck,
  HealthCheckResult,
} from "../../../src/core/interfaces/database-engine.interface.js";
import { engines } from "../helpers/engines.js";

// --- Mocks ---

const mockGetHealthChecks = jest.fn<() => HealthCheck[]>();

const mockEngine = {
  getHealthChecks: mockGetHealthChecks,
  getEngineName: jest.fn<() => string>(),
};

jest.unstable_mockModule(
  "../../../src/infra/engines/engine-factory.js",
  () => ({
    createEngine: jest.fn().mockReturnValue(mockEngine),
  }),
);

const mockResolveEngineAndConnection = jest.fn<() => Promise<any>>();

jest.unstable_mockModule(
  "../../../src/infra/engines/resolve-connection.js",
  () => ({
    resolveEngineAndConnection: mockResolveEngineAndConnection,
  }),
);

const mockSpinnerSucceed = jest.fn();
const mockSpinnerFail = jest.fn();
const mockSpinnerWarn = jest.fn();
const mockSpinnerStart = jest.fn().mockReturnValue({
  succeed: mockSpinnerSucceed,
  fail: mockSpinnerFail,
  warn: mockSpinnerWarn,
});

jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockImplementation(() => ({ start: mockSpinnerStart })),
}));

jest.unstable_mockModule("chalk", () => ({
  default: {
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
  },
}));

// Load the module after mocks
const { registerDoctorCommand: registerDoctorCmd } =
  await import("../../../src/commands/doctor.js");

// --- Helpers ---

type ActionFn = () => Promise<void>;

function buildFakeProgram() {
  let capturedAction: ActionFn | null = null;
  let capturedCommandName: string | null = null;

  const command = {
    description: jest.fn().mockReturnThis(),
    action(fn: ActionFn) {
      capturedAction = fn;
      return this;
    },
  };

  const program = {
    command: jest.fn((name: string) => {
      capturedCommandName = name;
      return command;
    }),
    opts: jest.fn().mockReturnValue({}),
    invokeAction: async () => {
      if (!capturedAction) throw new Error("action not registered");
      await capturedAction();
    },
  };

  return {
    program: program as unknown as typeof program,
    command,
    getCapturedCommandName: () => capturedCommandName as string | null,
  };
}

function makeRule(
  status: HealthCheckResult["status"],
  message: string,
): HealthCheck {
  return {
    name: "Test rule",
    pendingMessage: "Checking rule...",
    run: jest
      .fn<() => Promise<HealthCheckResult>>()
      .mockResolvedValue({ status, message }),
  };
}

// --- Tests ---

describe.each(engines)(
  "registerDoctorCommand ($engineName)",
  ({ engineType, engineName, defaultOpts }) => {
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;

    beforeAll(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockEngine.getEngineName.mockReturnValue(engineName);
      mockResolveEngineAndConnection.mockResolvedValue({
        engine: mockEngine,
        engineType,
        opts: defaultOpts,
      });
    });

    afterAll(() => {
      consoleLogSpy.mockRestore();
    });

    it("registers a 'doctor' command on the program", () => {
      const { program, getCapturedCommandName } = buildFakeProgram();
      registerDoctorCmd(program as any);
      expect(getCapturedCommandName()).toBe("doctor");
    });

    it("displays success message when all health checks pass", async () => {
      mockGetHealthChecks.mockReturnValue([makeRule("success", "Rule passed")]);

      const { program } = buildFakeProgram();
      registerDoctorCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerSucceed).toHaveBeenCalledWith("Rule passed");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Your system is fully equipped to run Herdux commands!",
        ),
      );
    });

    it("displays warning spinner when a health check returns warn status", async () => {
      mockGetHealthChecks.mockReturnValue([makeRule("warn", "Rule warning")]);

      const { program } = buildFakeProgram();
      registerDoctorCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerWarn).toHaveBeenCalledWith(
        expect.stringContaining("Rule warning"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Your system is fully equipped to run Herdux commands!",
        ),
      );
    });

    it("displays failure and overall error message when a health check fails", async () => {
      mockGetHealthChecks.mockReturnValue([makeRule("error", "Rule failed")]);

      const { program } = buildFakeProgram();
      registerDoctorCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerFail).toHaveBeenCalledWith(
        expect.stringContaining("Rule failed"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Some dependencies are missing"),
      );
    });

    it("handles runtime exceptions thrown during a health check", async () => {
      const crashingRule: HealthCheck = {
        name: "Crash rule",
        pendingMessage: "Checking crash...",
        run: jest
          .fn<() => Promise<HealthCheckResult>>()
          .mockRejectedValue(new Error("Crashing error")),
      };
      mockGetHealthChecks.mockReturnValue([crashingRule]);

      const { program } = buildFakeProgram();
      registerDoctorCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerFail).toHaveBeenCalledWith(
        expect.stringContaining("Crash rule failed: Crashing error"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Some dependencies are missing"),
      );
    });

    it("sets allOk to false when checks are mixed (success + warn + error)", async () => {
      // Ensures that a passing check does not mask a later failing one —
      // allOk must reflect the worst result across the entire run.
      mockGetHealthChecks.mockReturnValue([
        makeRule("success", "Check A passed"),
        makeRule("warn", "Check B warning"),
        makeRule("error", "Check C failed"),
      ]);

      const { program } = buildFakeProgram();
      registerDoctorCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerSucceed).toHaveBeenCalledWith("Check A passed");
      expect(mockSpinnerWarn).toHaveBeenCalledWith(
        expect.stringContaining("Check B warning"),
      );
      expect(mockSpinnerFail).toHaveBeenCalledWith(
        expect.stringContaining("Check C failed"),
      );

      // allOk must be false — the error check must win over the success and warn checks
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Some dependencies are missing"),
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Your system is fully equipped to run Herdux commands!",
        ),
      );
    });
  },
);
