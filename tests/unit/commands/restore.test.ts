import { jest } from "@jest/globals";

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<void>>();
const mockCreateDatabase = jest.fn<() => Promise<void>>();
const mockRestoreDatabase = jest.fn<() => Promise<void>>();

jest.unstable_mockModule(
  "../../../src/infra/engines/postgres/postgres.engine.js",
  () => ({
    PostgresEngine: jest.fn().mockImplementation(() => ({
      checkClientVersion: mockCheckClientVersion,
      createDatabase: mockCreateDatabase,
      restoreDatabase: mockRestoreDatabase,
      getEngineName: jest.fn().mockReturnValue("PostgreSQL"),
    })),
  }),
);

jest.unstable_mockModule(
  "../../../src/infra/engines/postgres/resolve-connection.js",
  () => ({
    resolveConnectionOptions: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ host: "localhost", port: 5432, user: "postgres" }),
      ),
  }),
);

const mockSpinnerSucceed = jest.fn();
const mockSpinnerFail = jest.fn();
const mockSpinnerInstance = {
  succeed: mockSpinnerSucceed,
  fail: mockSpinnerFail,
  text: "",
};
const mockSpinnerStart = jest.fn().mockReturnValue(mockSpinnerInstance);

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
    dim: (s: string) => s,
  },
}));

// Load the module after mocks
const { registerRestoreCommand: registerRestoreCmd } =
  await import("../../../src/commands/restore.js");

// --- Helpers ---

type ActionFn = (
  file: string,
  options: { db: string; format?: string },
) => Promise<void>;

function buildFakeProgram(programOpts: Record<string, unknown> = {}) {
  let capturedAction: ActionFn | null = null;
  let capturedCommandName: string | null = null;

  const command = {
    alias: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    requiredOption: jest.fn().mockReturnThis(),
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
      file: string,
      options: { db: string; format?: string } = { db: "testdb" },
    ) => {
      if (!capturedAction) throw new Error("action not registered");
      try {
        await capturedAction(file, options);
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

describe("registerRestoreCommand", () => {
  const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("PROCESS_EXIT_MOCK");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckClientVersion.mockResolvedValue(undefined);
    mockCreateDatabase.mockResolvedValue(undefined);
    mockRestoreDatabase.mockResolvedValue(undefined);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("registers a 'restore <file>' command on the program", () => {
    const { program, getCapturedCommandName } = buildFakeProgram();
    registerRestoreCmd(program as any);
    expect(getCapturedCommandName()).toBe("restore <file>");
  });

  it("fails and exits if an invalid format is provided", async () => {
    const { program } = buildFakeProgram();
    registerRestoreCmd(program as any);
    await program.invokeAction("dump.sql", {
      db: "testdb",
      format: "invalid-format",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid format "invalid-format"'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(mockRestoreDatabase).not.toHaveBeenCalled();
  });

  it("successfully restores an existing database", async () => {
    mockCreateDatabase.mockRejectedValue(
      new Error('database "testdb" already exists'),
    );

    const { program } = buildFakeProgram();
    registerRestoreCmd(program as any);
    await program.invokeAction("dump.sql", { db: "testdb", format: "custom" });

    expect(mockRestoreDatabase).toHaveBeenCalledWith(
      "dump.sql",
      "testdb",
      expect.any(Object),
      "custom",
    );
    expect(mockSpinnerSucceed).toHaveBeenCalledWith(
      expect.stringContaining('Database "testdb" restored successfully'),
    );
    // didCreateDb was false — the "automatically created" note must not appear
    expect(mockSpinnerSucceed).not.toHaveBeenCalledWith(
      expect.stringContaining("automatically created"),
    );
  });

  it("auto-creates the database and restores when it does not exist", async () => {
    mockCreateDatabase.mockResolvedValue(undefined);

    const { program } = buildFakeProgram();
    registerRestoreCmd(program as any);
    await program.invokeAction("dump.sql", { db: "testdb" });

    expect(mockCreateDatabase).toHaveBeenCalledWith(
      "testdb",
      expect.any(Object),
    );
    expect(mockRestoreDatabase).toHaveBeenCalledWith(
      "dump.sql",
      "testdb",
      expect.any(Object),
      undefined,
    );
    expect(mockSpinnerSucceed).toHaveBeenCalledWith(
      expect.stringContaining("automatically created"),
    );
  });

  it("fails and exits when database creation throws an unexpected error", async () => {
    mockCreateDatabase.mockRejectedValue(new Error("permission denied"));

    const { program } = buildFakeProgram();
    registerRestoreCmd(program as any);
    await program.invokeAction("dump.sql", { db: "testdb" });

    expect(mockSpinnerFail).toHaveBeenCalledWith(
      'Failed to verify or create database "testdb"',
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("permission denied"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(mockRestoreDatabase).not.toHaveBeenCalled();
  });

  it("fails and exits when the restore engine throws an error", async () => {
    mockRestoreDatabase.mockRejectedValue(new Error("pg_restore failed"));

    const { program } = buildFakeProgram();
    registerRestoreCmd(program as any);
    await program.invokeAction("dump.sql", { db: "testdb" });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("pg_restore failed"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("handles non-Error exceptions gracefully", async () => {
    mockRestoreDatabase.mockRejectedValue("unexpected string error");

    const { program } = buildFakeProgram();
    registerRestoreCmd(program as any);
    await program.invokeAction("dump.sql", { db: "testdb" });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("unexpected string error"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
