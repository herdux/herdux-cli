import { jest } from "@jest/globals";

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<void>>();
const mockCreateDatabase = jest.fn<() => Promise<void>>();

jest.unstable_mockModule(
  "../../../src/infra/engines/postgres/postgres.engine.js",
  () => ({
    PostgresEngine: jest.fn().mockImplementation(() => ({
      checkClientVersion: mockCheckClientVersion,
      createDatabase: mockCreateDatabase,
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

describe("registerCreateCommand", () => {
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
});
