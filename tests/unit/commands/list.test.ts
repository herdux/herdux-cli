import { jest } from "@jest/globals";
import type { DatabaseInfo } from "../../../src/core/interfaces/database-engine.interface.js";

// --- Mocks ---

const mockCheckClientVersion = jest.fn<() => Promise<void>>();
const mockListDatabases = jest.fn<() => Promise<DatabaseInfo[]>>();

const mockEngine = {
  checkClientVersion: mockCheckClientVersion,
  listDatabases: mockListDatabases,
  getEngineName: jest.fn().mockReturnValue("PostgreSQL"),
};

jest.unstable_mockModule(
  "../../../src/infra/engines/engine-factory.js",
  () => ({
    createEngine: jest.fn().mockReturnValue(mockEngine),
  }),
);

jest.unstable_mockModule(
  "../../../src/infra/engines/resolve-connection.js",
  () => ({
    resolveEngineAndConnection: jest.fn().mockImplementation(() =>
      Promise.resolve({
        engine: mockEngine,
        engineType: "postgres",
        opts: { host: "localhost", port: 5432, user: "postgres" },
      }),
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
const { registerListCommand } = await import("../../../src/commands/list.js");

// --- Helpers ---

type ActionFn = (options: { size?: boolean }) => Promise<void>;

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
    invokeAction: async (options: { size?: boolean } = {}) => {
      if (!capturedAction) throw new Error("action not registered");
      try {
        await capturedAction(options);
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

describe("registerListCommand", () => {
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
    mockListDatabases.mockResolvedValue([]);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("registers a 'list' command on the program", () => {
    const { program, getCapturedCommandName } = buildFakeProgram();
    registerListCommand(program as any);
    expect(program.command).toHaveBeenLastCalledWith("list");
    expect(getCapturedCommandName()).toBe("list");
  });

  it("successfully lists databases", async () => {
    mockListDatabases.mockResolvedValue([
      { name: "db1", owner: "postgres", encoding: "UTF8" },
      { name: "db2", owner: "root", encoding: "UTF8" },
    ]);

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({ size: false });

    expect(mockListDatabases).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeSize: false }),
    );
    expect(mockSpinnerSucceed).toHaveBeenLastCalledWith(
      "Found 2 database(s)\n",
    );
    // Header + separator + 2 rows + trailing newline
    expect(consoleLogSpy).toHaveBeenCalledTimes(5);
  });

  it("shows 'No databases found' when the list is empty", async () => {
    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({});

    expect(consoleLogSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("No databases found."),
    );
  });

  it("includes SIZE column when --size flag is passed", async () => {
    mockListDatabases.mockResolvedValue([
      { name: "bigdb", owner: "admin", encoding: "UTF8", size: "1024 MB" },
    ]);

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({ size: true });

    expect(mockListDatabases).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeSize: true }),
    );

    const allOutput = consoleLogSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("SIZE");
  });

  it("does not render size column when db.size is undefined", async () => {
    mockListDatabases.mockResolvedValue([
      { name: "nodb", owner: "owner1", encoding: "UTF8", size: undefined },
    ]);

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({ size: true });

    const rowCall = consoleLogSpy.mock.calls.find((c) =>
      String(c[0]).includes("nodb"),
    );
    expect(rowCall).toBeDefined();
  });

  it("handles Error exceptions gracefully and exits", async () => {
    mockCheckClientVersion.mockRejectedValue(new Error("connection refused"));

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({});

    expect(consoleErrorSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("connection refused"),
    );
    expect(processExitSpy).toHaveBeenLastCalledWith(1);
  });

  it("handles non-Error exceptions gracefully and exits", async () => {
    mockCheckClientVersion.mockRejectedValue("string error");

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({});

    expect(consoleErrorSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("string error"),
    );
    expect(processExitSpy).toHaveBeenLastCalledWith(1);
  });

  it("handles listDatabases Error exceptions gracefully and exits", async () => {
    mockListDatabases.mockRejectedValue(new Error("query timeout"));

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({});

    expect(consoleErrorSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("query timeout"),
    );
    expect(processExitSpy).toHaveBeenLastCalledWith(1);
  });

  it("handles listDatabases non-Error exceptions gracefully and exits", async () => {
    mockListDatabases.mockRejectedValue("unexpected db error");

    const { program } = buildFakeProgram();
    registerListCommand(program as any);
    await program.invokeAction({});

    expect(consoleErrorSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("unexpected db error"),
    );
    expect(processExitSpy).toHaveBeenLastCalledWith(1);
  });
});
