import { jest } from "@jest/globals";
import { engines } from "../helpers/engines.js";

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<void>>();
const mockCreateDatabase = jest.fn<() => Promise<void>>();

const mockEngine = {
  checkClientVersion: mockCheckClientVersion,
  createDatabase: mockCreateDatabase,
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
const mockSpinnerStart = jest
  .fn()
  .mockReturnValue({ succeed: mockSpinnerSucceed, fail: jest.fn() });

jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockImplementation(() => ({ start: mockSpinnerStart })),
}));

jest.unstable_mockModule("chalk", () => ({
  default: {
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
  },
}));

// Load the module after mocks
const { registerCreateCommand: registerCreateCmd } =
  await import("../../../src/commands/create.js");

// --- Helpers ---

type ActionFn = (name: string) => Promise<void>;

function buildFakeProgram(programOpts: Record<string, unknown> = {}) {
  let capturedAction: ActionFn | null = null;
  let capturedCommandName: string | null = null;

  const command = {
    alias: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
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
    opts: jest.fn().mockReturnValue(programOpts),
    invokeAction: async (name: string) => {
      if (!capturedAction) throw new Error("action not registered");
      try {
        await capturedAction(name);
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
  "registerCreateCommand ($engineName)",
  ({ engineType, engineName, defaultOpts }) => {
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
      mockCheckClientVersion.mockResolvedValue(undefined);
      mockCreateDatabase.mockResolvedValue(undefined);
    });

    afterAll(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("registers a 'create <name>' command on the program", () => {
      const { program, getCapturedCommandName } = buildFakeProgram();
      registerCreateCmd(program as any);
      expect(getCapturedCommandName()).toBe("create <name>");
    });

    it("successfully creates a database", async () => {
      const { program } = buildFakeProgram();
      registerCreateCmd(program as any);
      await program.invokeAction("testdb");

      expect(mockCreateDatabase).toHaveBeenLastCalledWith(
        "testdb",
        expect.any(Object),
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
        'Database "testdb" created successfully\n',
      );
    });

    it("exits if the engine throws an error", async () => {
      mockCreateDatabase.mockRejectedValue(new Error("Permission denied"));
      const { program } = buildFakeProgram();
      registerCreateCmd(program as any);
      await program.invokeAction("testdb");

      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        expect.stringContaining("Permission denied"),
      );
      expect(processExitSpy).toHaveBeenLastCalledWith(1);
    });

    it("handles non-Error exceptions gracefully", async () => {
      mockCreateDatabase.mockRejectedValue("unexpected string error");
      const { program } = buildFakeProgram();
      registerCreateCmd(program as any);
      await program.invokeAction("testdb");

      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        expect.stringContaining("unexpected string error"),
      );
      expect(processExitSpy).toHaveBeenLastCalledWith(1);
    });

    it("passes the config options to resolveEngineAndConnection", async () => {
      const { resolveEngineAndConnection: mockResolver } =
        await import("../../../src/infra/engines/resolve-connection.js");
      const { program } = buildFakeProgram({ engine: "mysql" });
      registerCreateCmd(program as any);
      await program.invokeAction("testdb");

      expect(mockResolver).toHaveBeenCalledWith(
        expect.objectContaining({ engine: "mysql" }),
      );
    });

    it("fails and exits if checkClientVersion throws", async () => {
      mockCheckClientVersion.mockRejectedValue(new Error("client not found"));
      const { program } = buildFakeProgram();
      registerCreateCmd(program as any);
      await program.invokeAction("testdb");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("client not found"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockCreateDatabase).not.toHaveBeenCalled();
    });
  },
);
