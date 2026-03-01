import { jest } from "@jest/globals";

// --- Mocks ---

const mockSetDefault = jest.fn<(key: string, value: string) => void>();
const mockGetDefault = jest.fn<() => Record<string, string>>();
const mockLoadConfig = jest.fn<
  () => {
    default: Record<string, string>;
    servers: Record<
      string,
      { host?: string; port?: string; user?: string; password?: string }
    >;
    scan_ports: string[];
  }
>();
const mockResetConfig = jest.fn<() => void>();
const mockAddServer =
  jest.fn<(name: string, opts: Record<string, string>) => void>();
const mockRemoveServer = jest.fn<(name: string) => boolean>();
const mockSetScanPorts = jest.fn<(ports: string[]) => void>();
const mockGetConfigPath = jest
  .fn<() => string>()
  .mockReturnValue("/mock/path/config.json");

jest.unstable_mockModule("../../../src/infra/config/config.service.js", () => ({
  setDefault: mockSetDefault,
  getDefault: mockGetDefault,
  loadConfig: mockLoadConfig,
  resetConfig: mockResetConfig,
  addServer: mockAddServer,
  removeServer: mockRemoveServer,
  setScanPorts: mockSetScanPorts,
  getConfigPath: mockGetConfigPath,
}));

const mockLoggerError = jest.fn<(msg: string) => void>();
const mockLoggerSuccess = jest.fn<(msg: string) => void>();
const mockLoggerLine = jest.fn<(msg: string) => void>();
const mockLoggerWarn = jest.fn<(msg: string) => void>();
const mockLoggerTitle = jest.fn<(msg: string) => void>();

jest.unstable_mockModule("../../../src/presentation/logger.js", () => ({
  logger: {
    error: mockLoggerError,
    success: mockLoggerSuccess,
    line: mockLoggerLine,
    warn: mockLoggerWarn,
    title: mockLoggerTitle,
  },
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
const { registerConfigCommand: registerConfigCmd } =
  await import("../../../src/commands/config.js");

// --- Helpers ---

type ActionFn = (...args: unknown[]) => void | Promise<void>;

function buildFakeProgram(programOpts: Record<string, unknown> = {}) {
  const capturedActions = new Map<string, ActionFn>();

  const createCommandMocker = (
    currentName: string,
  ): Record<string, unknown> => ({
    command: jest.fn((name: string) => createCommandMocker(name.split(" ")[0])),
    description: jest.fn().mockReturnThis(),
    helpCommand: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
    alias: jest.fn().mockReturnThis(),
    action: jest.fn((fn: ActionFn) => {
      capturedActions.set(currentName, fn);
      return createCommandMocker(currentName);
    }),
  });

  const program = {
    command: jest.fn((name: string) => createCommandMocker(name.split(" ")[0])),
    opts: jest.fn().mockReturnValue(programOpts),
    invokeAction: async (cmdName: string, ...args: unknown[]) => {
      const action = capturedActions.get(cmdName);
      if (!action) throw new Error(`action not registered for: ${cmdName}`);
      try {
        await action(...args);
      } catch (err) {
        if (err instanceof Error && err.message !== "PROCESS_EXIT_MOCK")
          throw err;
      }
    },
  };

  return { program: program as unknown as typeof program };
}

// --- Tests ---

describe("registerConfigCommand", () => {
  const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("PROCESS_EXIT_MOCK");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("registers the 'config' command on the program", () => {
    const { program } = buildFakeProgram();
    registerConfigCmd(program as any);
    expect(program.command).toHaveBeenCalledWith("config");
  });

  describe("set subcommand", () => {
    it("sets a valid configuration key", async () => {
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("set", "port", "5432");

      expect(mockSetDefault).toHaveBeenCalledWith("port", "5432");
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("port"),
      );
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("5432"),
      );
    });

    it("masks password values in display", async () => {
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("set", "password", "supersecret");

      expect(mockSetDefault).toHaveBeenCalledWith("password", "supersecret");
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("••••••"),
      );
      expect(mockLoggerSuccess).not.toHaveBeenCalledWith(
        expect.stringContaining("supersecret"),
      );
    });

    it("errors and exits if an invalid key is provided", async () => {
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("set", "invalid_key", "value");

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Invalid key"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockSetDefault).not.toHaveBeenCalled();
    });
  });

  describe("get subcommand", () => {
    it("gets and displays a valid configuration key", async () => {
      mockGetDefault.mockReturnValue({ port: "5432" });
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("get", "port");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("port: 5432"),
      );
    });

    it("displays a warning if the key is not set", async () => {
      mockGetDefault.mockReturnValue({});
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("get", "port");

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("No value set"),
      );
    });
  });

  describe("list subcommand", () => {
    it("lists default connection and server profiles", async () => {
      mockLoadConfig.mockReturnValue({
        default: { user: "postgres", password: "123" },
        servers: { prod: { host: "aws.com" } },
        scan_ports: [],
      });
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("list");

      expect(mockLoggerTitle).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("postgres"),
      );
      // Password must be masked — raw value must never appear
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("••••••"),
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("123"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("aws.com"),
      );
    });

    it("displays custom scan_ports when configured", async () => {
      mockLoadConfig.mockReturnValue({
        default: {},
        servers: {},
        scan_ports: ["5432", "5433"],
      });
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("list");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("5432, 5433"),
      );
    });

    it("does not display scan_ports section when the list is empty", async () => {
      mockLoadConfig.mockReturnValue({
        default: {},
        servers: {},
        scan_ports: [],
      });
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("list");

      // The "Custom Scan Ports" header must not be rendered for an empty array
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Custom Scan Ports"),
      );
    });

    it("shows empty state messages when no configurations exist", async () => {
      mockLoadConfig.mockReturnValue({
        default: {},
        servers: {},
        scan_ports: [],
      });
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("list");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No default connection configured"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No server profiles configured"),
      );
    });
  });

  describe("reset subcommand", () => {
    it("resets the configuration", async () => {
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("reset");

      expect(mockResetConfig).toHaveBeenCalled();
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("reset successfully"),
      );
    });
  });

  describe("add-server subcommand", () => {
    it("errors and exits if no global options are provided", async () => {
      const { program } = buildFakeProgram({});
      registerConfigCmd(program as any);
      await program.invokeAction("add-server", "local_prod");

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Provide at least one option"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("adds a server profile utilizing global options", async () => {
      const { program } = buildFakeProgram({ host: "localhost", port: "5432" });
      registerConfigCmd(program as any);
      await program.invokeAction("add-server", "local_prod");

      expect(mockAddServer).toHaveBeenCalledWith("local_prod", {
        host: "localhost",
        port: "5432",
      });
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("local_prod"),
      );
    });
  });

  describe("remove-server subcommand", () => {
    it("logs success when a server is successfully removed", async () => {
      mockRemoveServer.mockReturnValue(true);
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("remove-server", "local_prod");

      expect(mockRemoveServer).toHaveBeenCalledWith("local_prod");
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("removed"),
      );
    });

    it("logs warning when the server does not exist", async () => {
      mockRemoveServer.mockReturnValue(false);
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("remove-server", "missing_prod");

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("not found"),
      );
    });
  });

  describe("scan-ports subcommand", () => {
    it("sets the scan ports array", async () => {
      const { program } = buildFakeProgram();
      registerConfigCmd(program as any);
      await program.invokeAction("scan-ports", ["5432", "5433"]);

      expect(mockSetScanPorts).toHaveBeenCalledWith(["5432", "5433"]);
      expect(mockLoggerSuccess).toHaveBeenCalledWith(
        expect.stringContaining("5432, 5433"),
      );
    });
  });
});
