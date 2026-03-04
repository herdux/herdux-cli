import { jest } from "@jest/globals";

// --- Mocks (must be declared before dynamic import) ---

const mockGetDefault = jest.fn<() => Record<string, unknown>>();
const mockGetServer = jest.fn<
  (name: string) => {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    engine?: string;
  } | null
>();
const mockListServers = jest.fn<
  () => Record<
    string,
    {
      host?: string;
      port?: number;
      user?: string;
      password?: string;
      engine?: string;
    }
  >
>();

jest.unstable_mockModule("../../../src/infra/config/config.service.js", () => ({
  getDefault: mockGetDefault,
  getServer: mockGetServer,
  listServers: mockListServers,
}));

const mockDiscoverInstances =
  jest.fn<() => Promise<{ port: number; version: string }[]>>();
const mockGetDefaultConnectionOptions =
  jest.fn<() => { host?: string; port?: number | string; user?: string }>();
const mockGetEngineName = jest.fn<() => string>();

const mockEngine = {
  discoverInstances: mockDiscoverInstances,
  getDefaultConnectionOptions: mockGetDefaultConnectionOptions,
  getEngineName: mockGetEngineName,
};

const mockCreateEngine = jest.fn<() => typeof mockEngine>();

jest.unstable_mockModule(
  "../../../src/infra/engines/engine-factory.js",
  () => ({
    createEngine: mockCreateEngine,
  }),
);

const mockPrompts = jest.fn<() => Promise<Record<string, unknown>>>();
jest.unstable_mockModule("prompts", () => ({ default: mockPrompts }));

const mockSpinnerSucceed = jest.fn();
const mockSpinnerFail = jest.fn();
const mockOraInstance = {
  start: jest.fn().mockReturnThis(),
  succeed: mockSpinnerSucceed,
  fail: mockSpinnerFail,
};
jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockReturnValue(mockOraInstance),
}));

jest.unstable_mockModule("chalk", () => ({
  default: {
    green: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    red: (s: string) => s,
  },
}));

const mockLoggerError = jest.fn<(msg: string) => void>();
const mockLoggerInfo = jest.fn<(msg: string) => void>();
const mockLoggerLine = jest.fn<(msg: string) => void>();
const mockLoggerBlank = jest.fn<() => void>();

jest.unstable_mockModule("../../../src/presentation/logger.js", () => ({
  logger: {
    error: mockLoggerError,
    info: mockLoggerInfo,
    line: mockLoggerLine,
    blank: mockLoggerBlank,
  },
}));

// Dynamic import after all mocks
const {
  resolveEngineAndConnection,
  _resolveEngineType,
  _promptServerSelection,
} = await import("../../../src/infra/engines/resolve-connection.js");

// --- Tests ---

describe("_resolveEngineType", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServer.mockReturnValue(null);
  });

  describe("CLI flag takes precedence", () => {
    it("returns the rawEngine flag when provided, ignoring server and defaults", () => {
      mockGetServer.mockReturnValue({ engine: "mysql" });
      const result = _resolveEngineType("postgres", "some-server", {
        engine: "mysql",
      } as never);
      expect(result).toBe("postgres");
    });

    it("returns 'mysql' when rawEngine is mysql even if savedDefaults says postgres", () => {
      const result = _resolveEngineType("mysql", undefined, {
        engine: "postgres",
      } as never);
      expect(result).toBe("mysql");
    });
  });

  describe("server profile engine fallback", () => {
    it("returns the engine from the server profile when rawEngine is undefined", () => {
      mockGetServer.mockReturnValue({ engine: "mysql" });
      const result = _resolveEngineType(undefined, "my-server", {});
      expect(result).toBe("mysql");
    });

    it("returns savedDefaults.engine when server profile has no engine field", () => {
      mockGetServer.mockReturnValue({ port: 3306 });
      const result = _resolveEngineType(undefined, "my-server", {
        engine: "sqlite",
      } as never);
      expect(result).toBe("sqlite");
    });

    it("returns 'postgres' when server profile has no engine and savedDefaults is empty", () => {
      mockGetServer.mockReturnValue({ port: 5432 });
      const result = _resolveEngineType(undefined, "my-server", {});
      expect(result).toBe("postgres");
    });
  });

  describe("savedDefaults fallback", () => {
    it("returns savedDefaults.engine when rawEngine and serverName are both undefined", () => {
      const result = _resolveEngineType(undefined, undefined, {
        engine: "mysql",
      } as never);
      expect(result).toBe("mysql");
    });

    it("returns 'postgres' as final fallback when everything is undefined", () => {
      const result = _resolveEngineType(undefined, undefined, {});
      expect(result).toBe("postgres");
    });
  });
});

describe("_promptServerSelection", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;
  let processExitSpy: ReturnType<typeof jest.spyOn>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("PROCESS_EXIT_MOCK");
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("returns undefined immediately without prompting", () => {
    it("returns undefined when serverNames is empty and no compatible defaults exist", async () => {
      const result = await _promptServerSelection({}, [], {});
      expect(result).toBeUndefined();
      expect(mockPrompts).not.toHaveBeenCalled();
    });

    it("returns undefined when serverNames is empty and default engine does not match requestedEngine", async () => {
      const result = await _promptServerSelection(
        {},
        [],
        { engine: "postgres" } as never,
        "mysql",
      );
      expect(result).toBeUndefined();
      expect(mockPrompts).not.toHaveBeenCalled();
    });
  });

  describe("auto-selects the single choice without prompting", () => {
    it("auto-selects and returns server name when exactly one server matches", async () => {
      const servers = { "my-pg": { port: 5432, engine: "postgres" } };
      const result = await _promptServerSelection(servers, ["my-pg"], {});
      expect(result).toBe("my-pg");
      expect(mockPrompts).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("my-pg"),
      );
    });

    it("auto-selects and returns undefined when single choice is __default__", async () => {
      const result = await _promptServerSelection(
        {},
        [],
        { engine: "postgres", port: 5432 } as never,
        "postgres",
      );
      expect(result).toBeUndefined();
      expect(mockPrompts).not.toHaveBeenCalled();
    });
  });

  describe("prompts when multiple choices are available", () => {
    it("calls prompts() and returns selected server name", async () => {
      const servers = {
        "pg-dev": { port: 5432, engine: "postgres" },
        "pg-prod": { port: 5433, engine: "postgres" },
      };
      mockPrompts.mockResolvedValue({ server: "pg-dev" });

      const result = await _promptServerSelection(
        servers,
        ["pg-dev", "pg-prod"],
        {},
      );
      expect(result).toBe("pg-dev");
      expect(mockPrompts).toHaveBeenCalledTimes(1);
    });

    it("calls prompts() and returns undefined when user selects __default__", async () => {
      const servers = { "pg-dev": { port: 5432, engine: "postgres" } };
      mockPrompts.mockResolvedValue({ server: "__default__" });

      const result = await _promptServerSelection(
        servers,
        ["pg-dev"],
        { engine: "postgres", port: 5432 } as never,
        "postgres",
      );
      // With default prepended, there are now 2 choices → prompts() is called
      expect(mockPrompts).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it("calls process.exit(0) when prompts returns empty (user cancelled)", async () => {
      const servers = {
        "pg-dev": { port: 5432, engine: "postgres" },
        "pg-prod": { port: 5433, engine: "postgres" },
      };
      mockPrompts.mockResolvedValue({ server: undefined });

      await expect(
        _promptServerSelection(servers, ["pg-dev", "pg-prod"], {}),
      ).rejects.toThrow("PROCESS_EXIT_MOCK");
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("default connection choice insertion", () => {
    it("prepends __default__ choice when savedDefaults exist and engine is compatible", async () => {
      const servers = { "pg-dev": { port: 5432, engine: "postgres" } };
      mockPrompts.mockResolvedValue({ server: "pg-dev" });

      await _promptServerSelection(
        servers,
        ["pg-dev"],
        { engine: "postgres", port: 5432 } as never,
        "postgres",
      );

      const callArgs = mockPrompts.mock.calls[0][0] as {
        choices: { value: string }[];
      };
      expect(callArgs.choices[0].value).toBe("__default__");
    });

    it("does not prepend __default__ when savedDefaults is empty", async () => {
      const servers = {
        "pg-dev": { port: 5432 },
        "pg-prod": { port: 5433 },
      };
      mockPrompts.mockResolvedValue({ server: "pg-dev" });

      await _promptServerSelection(servers, ["pg-dev", "pg-prod"], {});

      const callArgs = mockPrompts.mock.calls[0][0] as {
        choices: { value: string }[];
      };
      expect(
        callArgs.choices.find((c) => c.value === "__default__"),
      ).toBeUndefined();
    });

    it("does not prepend __default__ when requestedEngine does not match savedDefaults.engine", async () => {
      const servers = {
        "mysql-dev": { port: 3306, engine: "mysql" },
        "mysql-prod": { port: 3307, engine: "mysql" },
      };
      mockPrompts.mockResolvedValue({ server: "mysql-dev" });

      await _promptServerSelection(
        servers,
        ["mysql-dev", "mysql-prod"],
        { engine: "postgres" } as never,
        "mysql",
      );

      const callArgs = mockPrompts.mock.calls[0][0] as {
        choices: { value: string }[];
      };
      expect(
        callArgs.choices.find((c) => c.value === "__default__"),
      ).toBeUndefined();
    });

    it("prepends __default__ when requestedEngine is undefined regardless of savedDefaults.engine", async () => {
      const servers = {
        "pg-dev": { port: 5432 },
        "pg-prod": { port: 5433 },
      };
      mockPrompts.mockResolvedValue({ server: "pg-dev" });

      await _promptServerSelection(
        servers,
        ["pg-dev", "pg-prod"],
        { engine: "postgres", port: 5432 } as never,
        undefined,
      );

      const callArgs = mockPrompts.mock.calls[0][0] as {
        choices: { value: string }[];
      };
      expect(callArgs.choices[0].value).toBe("__default__");
    });
  });
});

describe("resolveEngineAndConnection", () => {
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

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.HERDUX_TEST_FORCE_TTY;
    mockGetDefault.mockReturnValue({});
    mockGetServer.mockReturnValue(null);
    mockListServers.mockReturnValue({});
    mockCreateEngine.mockReturnValue(mockEngine);
    mockGetDefaultConnectionOptions.mockReturnValue({
      host: "localhost",
      port: 5432,
      user: "postgres",
    });
    mockGetEngineName.mockReturnValue("PostgreSQL");
    mockDiscoverInstances.mockResolvedValue([]);
  });

  describe("server profile path (serverName provided directly)", () => {
    it("resolves using server profile and returns merged opts with engine defaults", async () => {
      mockGetServer.mockReturnValue({
        host: "db.prod",
        port: 5433,
        user: "admin",
        password: "secret",
        engine: "postgres",
      });

      const result = await resolveEngineAndConnection({ server: "prod" });

      expect(result.engineType).toBe("postgres");
      expect(result.opts).toMatchObject({
        host: "db.prod",
        port: 5433,
        user: "admin",
        password: "secret",
      });
    });

    it("CLI flags override server profile values when both are present", async () => {
      mockGetServer.mockReturnValue({
        host: "db.prod",
        port: 5433,
        user: "admin",
        password: "secret",
        engine: "postgres",
      });

      const result = await resolveEngineAndConnection({
        server: "prod",
        host: "override-host",
        user: "override-user",
      });

      expect(result.opts.host).toBe("override-host");
      expect(result.opts.user).toBe("override-user");
      expect(result.opts.port).toBe(5433); // from profile, not overridden
    });

    it("exits with process.exit(1) when serverName is given but profile is not found", async () => {
      mockGetServer.mockReturnValue(null);
      mockListServers.mockReturnValue({ other: { port: 5432 } });

      await expect(
        resolveEngineAndConnection({ server: "missing" }),
      ).rejects.toThrow("PROCESS_EXIT_MOCK");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("lists available profiles in error output when profile is not found", async () => {
      mockGetServer.mockReturnValue(null);
      mockListServers.mockReturnValue({ "pg-dev": { port: 5432 } });

      await expect(
        resolveEngineAndConnection({ server: "missing" }),
      ).rejects.toThrow("PROCESS_EXIT_MOCK");
      expect(mockLoggerLine).toHaveBeenCalledWith(
        expect.stringContaining("pg-dev"),
      );
    });

    it("shows '(none)' when profile not found and no servers exist", async () => {
      mockGetServer.mockReturnValue(null);
      mockListServers.mockReturnValue({});

      await expect(
        resolveEngineAndConnection({ server: "missing" }),
      ).rejects.toThrow("PROCESS_EXIT_MOCK");
      expect(mockLoggerLine).toHaveBeenCalledWith("(none)");
    });
  });

  describe("non-interactive path (CLI port or host provided)", () => {
    it("returns immediately with merged opts when --port is provided (skips TTY prompt)", async () => {
      const result = await resolveEngineAndConnection({ port: 5417 });

      expect(result.opts.port).toBe(5417);
      expect(mockListServers).not.toHaveBeenCalled();
      expect(mockDiscoverInstances).not.toHaveBeenCalled();
    });

    it("returns immediately when --host is provided (skips TTY prompt and auto-discovery)", async () => {
      const result = await resolveEngineAndConnection({
        host: "myserver",
        port: 5432,
      });

      expect(result.opts.host).toBe("myserver");
      expect(mockListServers).not.toHaveBeenCalled();
    });

    it("returns immediately when merged.port comes from savedDefaults", async () => {
      mockGetDefault.mockReturnValue({ port: 5435, host: "saved-host" });

      const result = await resolveEngineAndConnection({});

      expect(result.opts.port).toBe(5435);
      expect(result.opts.host).toBe("saved-host");
      expect(mockDiscoverInstances).not.toHaveBeenCalled();
    });
  });

  describe("SQLite / no-port engine path", () => {
    beforeEach(() => {
      mockGetDefaultConnectionOptions.mockReturnValue({
        host: "/home/user/.herdux/sqlite",
      });
    });

    it("returns opts without port discovery when engine has no default port", async () => {
      const result = await resolveEngineAndConnection({ engine: "sqlite" });

      expect(result.engineType).toBe("sqlite");
      expect(result.opts.port).toBeUndefined();
      expect(mockDiscoverInstances).not.toHaveBeenCalled();
    });

    it("uses engineDefaults.host when merged.host is undefined for SQLite", async () => {
      const result = await resolveEngineAndConnection({ engine: "sqlite" });

      expect(result.opts.host).toBe("/home/user/.herdux/sqlite");
    });

    it("prefers CLI host over engineDefaults.host for SQLite", async () => {
      const result = await resolveEngineAndConnection({
        engine: "sqlite",
        host: "/tmp/dbs",
      });

      expect(result.opts.host).toBe("/tmp/dbs");
    });
  });

  describe("auto-discovery path", () => {
    it("exits with process.exit(1) when discoverInstances returns 0 instances", async () => {
      mockDiscoverInstances.mockResolvedValue([]);

      await expect(resolveEngineAndConnection({})).rejects.toThrow(
        "PROCESS_EXIT_MOCK",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockSpinnerFail).toHaveBeenCalled();
    });

    it("returns correct opts when discoverInstances returns exactly 1 instance", async () => {
      mockDiscoverInstances.mockResolvedValue([
        { port: 5416, version: "PostgreSQL 15.1" },
      ]);

      const result = await resolveEngineAndConnection({});

      expect(result.opts.port).toBe(5416);
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining("5416"),
      );
    });

    it("calls prompts() when discoverInstances returns multiple instances", async () => {
      mockDiscoverInstances.mockResolvedValue([
        { port: 5432, version: "PostgreSQL 15.1" },
        { port: 5433, version: "PostgreSQL 14.5" },
      ]);
      mockPrompts.mockResolvedValue({ port: 5432 });

      await resolveEngineAndConnection({});

      expect(mockPrompts).toHaveBeenCalledTimes(1);
    });

    it("returns selected port when user picks from multiple instances", async () => {
      mockDiscoverInstances.mockResolvedValue([
        { port: 5432, version: "PostgreSQL 15.1" },
        { port: 5433, version: "PostgreSQL 14.5" },
      ]);
      mockPrompts.mockResolvedValue({ port: 5433 });

      const result = await resolveEngineAndConnection({});

      expect(result.opts.port).toBe(5433);
    });

    it("calls process.exit(0) when user cancels multi-instance prompt", async () => {
      mockDiscoverInstances.mockResolvedValue([
        { port: 5432, version: "PostgreSQL 15.1" },
        { port: 5433, version: "PostgreSQL 14.5" },
      ]);
      mockPrompts.mockResolvedValue({ port: undefined });

      await expect(resolveEngineAndConnection({})).rejects.toThrow(
        "PROCESS_EXIT_MOCK",
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("TTY detection for interactive server selection", () => {
    beforeEach(() => {
      process.env.HERDUX_TEST_FORCE_TTY = "1";
      // Make discoverInstances return something so tests don't fail at that step
      mockDiscoverInstances.mockResolvedValue([
        { port: 5432, version: "PostgreSQL 15.1" },
      ]);
    });

    afterEach(() => {
      delete process.env.HERDUX_TEST_FORCE_TTY;
    });

    it("calls listServers() when HERDUX_TEST_FORCE_TTY=1 and no port/host/server given", async () => {
      mockListServers.mockReturnValue({});

      await resolveEngineAndConnection({});

      expect(mockListServers).toHaveBeenCalled();
    });

    it("skips interactive prompt when port is explicitly provided even in TTY mode", async () => {
      await resolveEngineAndConnection({ port: 5432 });

      expect(mockListServers).not.toHaveBeenCalled();
    });

    it("skips interactive prompt when host is explicitly provided even in TTY mode", async () => {
      await resolveEngineAndConnection({ host: "myhost", port: 5432 });

      expect(mockListServers).not.toHaveBeenCalled();
    });

    it("filters server list by engine when rawOpts.engine is set in TTY mode", async () => {
      mockListServers.mockReturnValue({
        "pg-dev": { port: 5432, engine: "postgres" },
        "mysql-dev": { port: 3306, engine: "mysql" },
      });
      // "mysql-dev" will be auto-selected (only matching server), so provide the profile
      mockGetServer.mockReturnValue({
        host: "mysql-host",
        port: 3306,
        user: "root",
        engine: "mysql",
      });

      const result = await resolveEngineAndConnection({ engine: "mysql" });

      expect(mockListServers).toHaveBeenCalled();
      // Only mysql-dev should have been loaded (pg-dev was filtered out)
      expect(mockGetServer).toHaveBeenCalledWith("mysql-dev");
      expect(result.opts.port).toBe(3306);
    });

    it("sets serverName from promptServerSelection result when a server is chosen interactively", async () => {
      mockListServers.mockReturnValue({
        "pg-dev": { port: 5432, engine: "postgres" },
        "pg-prod": { port: 5433, engine: "postgres" },
      });
      mockGetServer.mockReturnValue({
        host: "pg-dev-host",
        port: 5432,
        user: "dev",
        engine: "postgres",
      });
      mockPrompts.mockResolvedValue({ server: "pg-dev" });

      const result = await resolveEngineAndConnection({});

      // resolveEngineAndConnection resolved using the server profile
      expect(mockGetServer).toHaveBeenCalledWith("pg-dev");
      expect(result.opts.host).toBe("pg-dev-host");
    });
  });
});
