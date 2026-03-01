import { jest } from "@jest/globals";

// --- Engine parametrize config ---

const engines = [
  {
    engineType: "postgres" as const,
    engineName: "PostgreSQL",
    defaultOpts: { host: "localhost", port: "5432", user: "postgres" },
  },
  {
    engineType: "mysql" as const,
    engineName: "MySQL",
    defaultOpts: { host: "localhost", port: "3306", user: "root" },
  },
];

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<void>>();
const mockDropDatabase = jest.fn<() => Promise<void>>();

const mockEngine = {
  checkClientVersion: mockCheckClientVersion,
  dropDatabase: mockDropDatabase,
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

const mockPromptsConfirm = jest.fn<() => Promise<{ confirm: boolean }>>();

jest.unstable_mockModule("prompts", () => ({
  default: jest.fn().mockImplementation(() => mockPromptsConfirm()),
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
const { registerDropCommand: registerDropCmd } =
  await import("../../../src/commands/drop.js");

// --- Helpers ---

type ActionFn = (name: string, options: { yes?: boolean }) => Promise<void>;

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
    invokeAction: async (database: string, options: { yes?: boolean } = {}) => {
      if (!capturedAction) throw new Error("action not registered");
      try {
        await capturedAction(database, options);
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
  "registerDropCommand ($engineName)",
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
      mockDropDatabase.mockResolvedValue(undefined);
    });

    afterAll(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("registers a 'drop <name>' command on the program", () => {
      const { program, getCapturedCommandName } = buildFakeProgram();
      registerDropCmd(program as any);
      expect(getCapturedCommandName()).toBe("drop <name>");
    });

    it("successfully drops database without confirmation if --yes is passed", async () => {
      const { program } = buildFakeProgram();
      registerDropCmd(program as any);
      await program.invokeAction("testdb", { yes: true });

      expect(mockDropDatabase).toHaveBeenCalledWith(
        "testdb",
        expect.any(Object),
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
        'Database "testdb" dropped successfully\n',
      );
      expect(mockPromptsConfirm).not.toHaveBeenCalled();
    });

    it("prompts for confirmation and drops if user confirms", async () => {
      mockPromptsConfirm.mockResolvedValue({ confirm: true });

      const { program } = buildFakeProgram();
      registerDropCmd(program as any);
      await program.invokeAction("testdb", {});

      expect(mockPromptsConfirm).toHaveBeenCalledTimes(1);
      expect(mockDropDatabase).toHaveBeenCalledWith(
        "testdb",
        expect.any(Object),
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
        'Database "testdb" dropped successfully\n',
      );
    });

    it("prompts for confirmation and cancels if user declines", async () => {
      mockPromptsConfirm.mockResolvedValue({ confirm: false });

      const { program } = buildFakeProgram();
      registerDropCmd(program as any);
      await program.invokeAction("testdb", {});

      expect(mockPromptsConfirm).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Operation cancelled"),
      );
      expect(mockDropDatabase).not.toHaveBeenCalled();
    });

    it("catches internal engine errors gracefully", async () => {
      mockDropDatabase.mockRejectedValue(new Error("Database is in use"));

      const { program } = buildFakeProgram();
      registerDropCmd(program as any);
      await program.invokeAction("testdb", { yes: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Database is in use"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("handles non-Error exceptions gracefully", async () => {
      mockDropDatabase.mockRejectedValue("unexpected string error");

      const { program } = buildFakeProgram();
      registerDropCmd(program as any);
      await program.invokeAction("testdb", { yes: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("unexpected string error"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("fails and exits if checkClientVersion throws", async () => {
      mockCheckClientVersion.mockRejectedValue(new Error("client not found"));
      const { program } = buildFakeProgram();
      registerDropCmd(program as any);
      await program.invokeAction("testdb", { yes: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("client not found"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockDropDatabase).not.toHaveBeenCalled();
    });
  },
);
