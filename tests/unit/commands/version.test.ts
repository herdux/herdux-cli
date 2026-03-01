import { jest } from "@jest/globals";
import type { DatabaseInstance } from "../../../src/core/interfaces/database-engine.interface.js";
import { engines } from "../helpers/engines.js";

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<string>>();
const mockDiscoverInstances = jest.fn<() => Promise<DatabaseInstance[]>>();

const mockEngine = {
  checkClientVersion: mockCheckClientVersion,
  discoverInstances: mockDiscoverInstances,
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
const mockSpinnerWarn = jest.fn();
const mockSpinnerStart = jest
  .fn()
  .mockReturnValue({ succeed: mockSpinnerSucceed, warn: mockSpinnerWarn });

jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockImplementation(() => ({ start: mockSpinnerStart })),
}));

// Chalk passthrough that supports both direct calls (chalk.red(s))
// and chained calls (chalk.bold.cyan(s), chalk.bgGreen.black(s))
const chalkFn = (s: string) => s;
chalkFn.cyan = (s: string) => s;
chalkFn.black = (s: string) => s;

jest.unstable_mockModule("chalk", () => ({
  default: {
    bold: chalkFn,
    bgGreen: chalkFn,
    cyan: (s: string) => s,
    gray: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
  },
}));

// Load the module after mocks
const { registerVersionCommand: registerVersionCmd } =
  await import("../../../src/commands/version.js");

// --- Helpers ---

type ActionFn = () => Promise<void>;

function buildFakeProgram() {
  let capturedAction: ActionFn | null = null;
  let capturedCommandName: string | null = null;

  const command = {
    alias: jest.fn().mockReturnThis(),
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
    version: jest.fn().mockReturnValue("1.0.0"),
    invokeAction: async () => {
      if (!capturedAction) throw new Error("action not registered");
      try {
        await capturedAction();
      } catch (err) {
        if (err instanceof Error && err.message !== "PROCESS_EXIT_MOCK")
          throw err;
      }
    },
  };

  return {
    program: program as unknown as typeof program,
    command,
    getCapturedCommandName: () => capturedCommandName as string | null,
  };
}

// --- Tests ---

describe.each(engines)(
  "registerVersionCommand ($engineName)",
  ({ engineType, engineName, defaultOpts, clientVersionStr }) => {
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
    let processExitSpy: ReturnType<typeof jest.spyOn>;

    beforeAll(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("PROCESS_EXIT_MOCK");
      });
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockEngine.getEngineName.mockReturnValue(engineName);
      mockResolveEngineAndConnection.mockResolvedValue({
        engine: mockEngine,
        engineType,
        opts: defaultOpts,
      });
      mockCheckClientVersion.mockResolvedValue(clientVersionStr);
      mockDiscoverInstances.mockResolvedValue([
        { port: "5432", version: `${engineName} 15.0`, status: "running" },
      ]);
    });

    afterAll(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("registers a 'version' command on the program", () => {
      const { program, getCapturedCommandName } = buildFakeProgram();
      registerVersionCmd(program as any);
      expect(getCapturedCommandName()).toBe("version");
    });

    it("prints client version and lists running instances", async () => {
      mockDiscoverInstances.mockResolvedValue([
        { port: "5432", version: "15.4", status: "running" },
        { port: "5433", version: "14.8", status: "running" },
      ]);

      const { program } = buildFakeProgram();
      registerVersionCmd(program as any);
      await program.invokeAction();

      expect(mockCheckClientVersion).toHaveBeenCalled();
      expect(mockDiscoverInstances).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(clientVersionStr),
      );
      // Verify both ports are rendered — not just the first one
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(":5432"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(":5433"),
      );
      // Explicitly assert count matches mocked instances — guards against beforeEach default of 1 leaking in
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining("Found 2 running server(s)"),
      );
      expect(mockSpinnerSucceed).not.toHaveBeenCalledWith(
        expect.stringContaining("Found 1 running server(s)"),
      );
    });

    it("displays warning when no instances are discovered", async () => {
      mockDiscoverInstances.mockResolvedValue([]);

      const { program } = buildFakeProgram();
      registerVersionCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerWarn).toHaveBeenCalledWith(
        expect.stringContaining(`No running ${engineName} servers found`),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No servers detected on common ports"),
      );
    });

    it("catches Error exceptions gracefully and exits", async () => {
      mockCheckClientVersion.mockRejectedValue(new Error("Engine fault"));

      const { program } = buildFakeProgram();
      registerVersionCmd(program as any);
      await program.invokeAction();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Engine fault"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("handles non-Error exceptions gracefully and exits", async () => {
      mockCheckClientVersion.mockRejectedValue("unexpected string error");

      const { program } = buildFakeProgram();
      registerVersionCmd(program as any);
      await program.invokeAction();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("unexpected string error"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  },
);
