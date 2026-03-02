import { jest } from "@jest/globals";

// --- Mocks ---

const mockInspectBackupFile = jest.fn<() => Promise<string>>();

jest.unstable_mockModule(
  "../../../src/infra/engines/inspect-backup.js",
  () => ({
    inspectBackupFile: mockInspectBackupFile,
  }),
);

jest.unstable_mockModule("chalk", () => ({
  default: {
    red: (s: string) => s,
  },
}));

// Load the module after mocks
const { registerInspectCommand: registerInspectCmd } =
  await import("../../../src/commands/inspect.js");

// --- Helpers ---

type ActionFn = (file: string) => Promise<void>;

function buildFakeProgram() {
  let capturedAction: ActionFn | null = null;
  let capturedCommandName: string | null = null;

  const command = {
    description: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
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
    invokeAction: async (file: string) => {
      if (!capturedAction) throw new Error("action not registered");
      try {
        await capturedAction(file);
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

describe("registerInspectCommand", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
  let processExitSpy: ReturnType<typeof jest.spyOn>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("PROCESS_EXIT_MOCK");
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockInspectBackupFile.mockResolvedValue("-- inspect output --");
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("registers an 'inspect <file>' command on the program", () => {
    const { program, getCapturedCommandName } = buildFakeProgram();
    registerInspectCmd(program as any);
    expect(getCapturedCommandName()).toBe("inspect <file>");
  });

  it("prints the output of inspectBackupFile on success", async () => {
    mockInspectBackupFile.mockResolvedValue(
      "ToC output line 1\nToC output line 2",
    );
    const { program } = buildFakeProgram();
    registerInspectCmd(program as any);
    await program.invokeAction("backup.dump");

    expect(mockInspectBackupFile).toHaveBeenCalledWith("backup.dump");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ToC output line 1\nToC output line 2",
    );
  });

  it("displays the error message and exits 1 when inspectBackupFile throws", async () => {
    mockInspectBackupFile.mockRejectedValue(
      new Error("File not found: backup.dump"),
    );
    const { program } = buildFakeProgram();
    registerInspectCmd(program as any);
    await program.invokeAction("backup.dump");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("File not found: backup.dump"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("displays the error message when extension is unsupported", async () => {
    mockInspectBackupFile.mockRejectedValue(
      new Error(
        'Unsupported file type ".bak". Supported extensions: .dump (PostgreSQL), .sql (any engine), .db / .sqlite (SQLite)',
      ),
    );
    const { program } = buildFakeProgram();
    registerInspectCmd(program as any);
    await program.invokeAction("archive.bak");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported file type"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("handles non-Error thrown values gracefully", async () => {
    mockInspectBackupFile.mockRejectedValue("raw string error");
    const { program } = buildFakeProgram();
    registerInspectCmd(program as any);
    await program.invokeAction("backup.dump");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("raw string error"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
