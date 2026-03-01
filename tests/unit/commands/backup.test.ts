import { jest } from "@jest/globals";
import { engines } from "../helpers/engines.js";

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<void>>();
const mockCheckBackupRequirements = jest.fn<() => Promise<void>>();
const mockBackupDatabase = jest.fn<() => Promise<string>>();
const mockDropDatabase = jest.fn<() => Promise<void>>();

const mockEngine = {
  checkClientVersion: mockCheckClientVersion,
  checkBackupRequirements: mockCheckBackupRequirements,
  backupDatabase: mockBackupDatabase,
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

const mockConfigGetDefault = jest
  .fn()
  .mockReturnValue({ output: "/default/backup/dir" });

jest.unstable_mockModule("../../../src/infra/config/config.service.js", () => ({
  getDefault: mockConfigGetDefault,
}));

const mockSpinnerSucceed = jest.fn();
const mockSpinnerStart = jest
  .fn()
  .mockReturnValue({ succeed: mockSpinnerSucceed, fail: jest.fn() });

jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockImplementation(() => ({ start: mockSpinnerStart })),
}));

const mockPromptsConfirm = jest.fn<() => Promise<{ confirmDrop: boolean }>>();

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
const { registerBackupCommand: registerBackupCmd } =
  await import("../../../src/commands/backup.js");

// --- Helpers ---

type ActionFn = (
  database: string,
  options: { output?: string; drop?: boolean; yes?: boolean; format: string },
) => Promise<void>;

function buildFakeProgram(programOpts: Record<string, unknown> = {}) {
  let capturedAction: ActionFn | null = null;
  let capturedCommandName: string | null = null;

  const command = {
    alias: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
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
    invokeAction: async (
      database: string,
      options: {
        output?: string;
        drop?: boolean;
        yes?: boolean;
        format: string;
      } = { format: "custom" },
    ) => {
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
  "registerBackupCommand ($engineName)",
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
      mockCheckBackupRequirements.mockResolvedValue(undefined);
      mockBackupDatabase.mockResolvedValue("/output/path/backup.dump");
      mockDropDatabase.mockResolvedValue(undefined);
      // Safe default: if a test triggers prompts without configuring the mock,
      // it returns { confirmDrop: false } instead of undefined — prevents silent failures.
      mockPromptsConfirm.mockResolvedValue({ confirmDrop: false });
    });

    afterAll(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("registers a 'backup <database>' command on the program", () => {
      const { program, getCapturedCommandName } = buildFakeProgram();
      registerBackupCmd(program as any);
      expect(getCapturedCommandName()).toBe("backup <database>");
    });

    it("successfully generates a backup using default config output dir", async () => {
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "custom" });

      expect(mockBackupDatabase).toHaveBeenLastCalledWith(
        "testdb",
        "/default/backup/dir",
        expect.any(Object),
        "custom",
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
        "Backup saved at /output/path/backup.dump\n",
      );
    });

    it("overrides output directory when --output flag is provided", async () => {
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", {
        format: "plain",
        output: "/custom/path",
      });

      expect(mockBackupDatabase).toHaveBeenCalledWith(
        "testdb",
        "/custom/path",
        expect.any(Object),
        "plain",
      );
    });

    it("exits if the database name contains invalid characters", async () => {
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("invalid name!", { format: "custom" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid database name"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockBackupDatabase).not.toHaveBeenCalled();
    });

    it("fails and exits if an invalid format is provided", async () => {
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "invalid-format" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid format "invalid-format"'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockBackupDatabase).not.toHaveBeenCalled();
    });

    it("Drops database if --drop and --yes are provided", async () => {
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", {
        format: "custom",
        drop: true,
        yes: true,
      });

      expect(mockDropDatabase).toHaveBeenCalledWith(
        "testdb",
        expect.any(Object),
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
        'Database "testdb" dropped successfully\n',
      );
    });

    it("Prompts to drop and executes if confirmed when --drop provided without --yes", async () => {
      mockPromptsConfirm.mockResolvedValue({ confirmDrop: true });
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "custom", drop: true });

      expect(mockPromptsConfirm).toHaveBeenCalledTimes(1);
      expect(mockDropDatabase).toHaveBeenCalledWith(
        "testdb",
        expect.any(Object),
      );
    });

    it("Prompts to drop and skips if not confirmed when --drop provided without --yes", async () => {
      mockPromptsConfirm.mockResolvedValue({ confirmDrop: false });
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "custom", drop: true });

      expect(mockPromptsConfirm).toHaveBeenCalledTimes(1);
      expect(mockDropDatabase).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipped dropping database "testdb".'),
      );
    });

    it("catches internal engine errors gracefully", async () => {
      mockBackupDatabase.mockRejectedValue(new Error("Disk full"));

      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "custom" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Disk full"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("fails and exits if checkClientVersion throws", async () => {
      mockCheckClientVersion.mockRejectedValue(
        new Error("dump tool not found"),
      );
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "custom" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("dump tool not found"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockBackupDatabase).not.toHaveBeenCalled();
    });

    it("successfully generates a backup in plain format", async () => {
      mockBackupDatabase.mockResolvedValue("/output/path/backup.sql");
      const { program } = buildFakeProgram();
      registerBackupCmd(program as any);
      await program.invokeAction("testdb", { format: "plain" });

      expect(mockBackupDatabase).toHaveBeenCalledWith(
        "testdb",
        "/default/backup/dir",
        expect.any(Object),
        "plain",
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
        "Backup saved at /output/path/backup.sql\n",
      );
    });
  },
);
