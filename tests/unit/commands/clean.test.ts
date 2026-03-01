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
const mockListDatabases =
  jest.fn<() => Promise<{ name: string; owner: string; encoding: string }[]>>();
const mockCheckBackupRequirements = jest.fn<() => Promise<void>>();
const mockBackupDatabase = jest.fn<() => Promise<string>>();
const mockDropDatabase = jest.fn<() => Promise<void>>();

const mockEngine = {
  checkClientVersion: mockCheckClientVersion,
  listDatabases: mockListDatabases,
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
const mockSpinnerStop = jest.fn();
const mockSpinnerFail = jest.fn();
// `text` is included so that assignments like `spinner.text = "..."` in the
// source code do not throw silently on a read-only or missing property.
const mockSpinnerInstance = {
  stop: mockSpinnerStop,
  succeed: mockSpinnerSucceed,
  fail: mockSpinnerFail,
  text: "",
};
const mockSpinnerStart = jest.fn().mockReturnValue(mockSpinnerInstance);

jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockImplementation(() => ({ start: mockSpinnerStart })),
}));

// Single prompts mock — called multiple times sequentially in the command
const mockPrompts = jest.fn<() => Promise<Record<string, unknown>>>();

jest.unstable_mockModule("prompts", () => ({
  default: jest.fn().mockImplementation(() => mockPrompts()),
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
const { registerCleanCommand: registerCleanCmd } =
  await import("../../../src/commands/clean.js");

// --- Helpers ---

type ActionFn = () => Promise<void>;

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
  "registerCleanCommand ($engineName)",
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
      mockListDatabases.mockResolvedValue([
        { name: "db1", owner: "postgres", encoding: "UTF8" },
        { name: "db2", owner: "admin", encoding: "UTF8" },
      ]);
      mockCheckBackupRequirements.mockResolvedValue(undefined);
      mockBackupDatabase.mockResolvedValue("/output/path/backup.dump");
      mockDropDatabase.mockResolvedValue(undefined);
    });

    afterAll(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("registers a 'clean' command on the program", () => {
      const { program, getCapturedCommandName } = buildFakeProgram();
      registerCleanCmd(program as any);
      expect(getCapturedCommandName()).toBe("clean");
    });

    it("shows 'No databases found' and returns if db list is empty", async () => {
      mockListDatabases.mockResolvedValue([]);
      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No databases found to clean."),
      );
      expect(mockPrompts).not.toHaveBeenCalled();
    });

    it("cancels operation if no database is selected in multiselect", async () => {
      // 1st prompts call: multiselect returns empty selection
      mockPrompts.mockResolvedValueOnce({ selectedDbs: [] });

      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clean operation cancelled."),
      );
      expect(mockDropDatabase).not.toHaveBeenCalled();
    });

    it("performs full clean WITH backups if user confirms backup and drop", async () => {
      // 1st: multiselect, 2nd: backup confirm, 3rd: final drop confirm
      mockPrompts
        .mockResolvedValueOnce({ selectedDbs: ["db1", "db2"] })
        .mockResolvedValueOnce({ backupFirst: true })
        .mockResolvedValueOnce({ confirm: true });

      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(mockBackupDatabase).toHaveBeenCalledTimes(2);
      expect(mockBackupDatabase).toHaveBeenCalledWith(
        "db1",
        "/default/backup/dir",
        expect.any(Object),
        "custom",
      );
      expect(mockBackupDatabase).toHaveBeenCalledWith(
        "db2",
        "/default/backup/dir",
        expect.any(Object),
        "custom",
      );

      expect(mockDropDatabase).toHaveBeenCalledTimes(2);
      expect(mockDropDatabase).toHaveBeenCalledWith("db1", expect.any(Object));
      expect(mockDropDatabase).toHaveBeenCalledWith("db2", expect.any(Object));
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith('Dropped "db2"');
    });

    it("performs full clean WITHOUT backups if user declines backups", async () => {
      mockPrompts
        .mockResolvedValueOnce({ selectedDbs: ["db1"] })
        .mockResolvedValueOnce({ backupFirst: false })
        .mockResolvedValueOnce({ confirm: true });

      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(mockBackupDatabase).not.toHaveBeenCalled();
      expect(mockDropDatabase).toHaveBeenCalledTimes(1);
    });

    it("aborts clean if user declines final confirm deletion", async () => {
      mockPrompts
        .mockResolvedValueOnce({ selectedDbs: ["db1"] })
        .mockResolvedValueOnce({ backupFirst: false })
        .mockResolvedValueOnce({ confirm: false });

      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clean operation aborted."),
      );
      expect(mockDropDatabase).not.toHaveBeenCalled();
    });

    it("aborts clean and exits if backup fails during the loop", async () => {
      mockPrompts
        .mockResolvedValueOnce({ selectedDbs: ["db1", "db2"] })
        .mockResolvedValueOnce({ backupFirst: true });

      mockBackupDatabase.mockRejectedValueOnce(new Error("Disk space full"));

      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerFail).toHaveBeenCalledWith("Failed to backup db1");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Aborting clean process to prevent data loss"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockDropDatabase).not.toHaveBeenCalled();
    });

    it("catches drop errors per-db without exiting and continues loop", async () => {
      mockPrompts
        .mockResolvedValueOnce({ selectedDbs: ["db1", "db2"] })
        .mockResolvedValueOnce({ backupFirst: false })
        .mockResolvedValueOnce({ confirm: true });

      mockDropDatabase
        .mockRejectedValueOnce(new Error("Active connections"))
        .mockResolvedValueOnce(undefined);

      const { program } = buildFakeProgram();
      registerCleanCmd(program as any);
      await program.invokeAction();

      expect(mockSpinnerFail).toHaveBeenCalledWith('Failed to drop "db1"');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Active connections"),
      );
      expect(mockSpinnerSucceed).toHaveBeenLastCalledWith('Dropped "db2"');
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  },
);
