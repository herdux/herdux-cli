import { jest } from "@jest/globals";

// --- Mocks ---

const mockRunCommand =
  jest.fn<
    () => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >();

const mockExeca =
  jest.fn<
    () => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >();

const mockExistsSync = jest.fn<() => boolean>();
const mockMkdirSync = jest.fn();

const mockCheckMongoshClient = jest
  .fn<() => Promise<string>>()
  .mockResolvedValue("mongosh 2.3.0");
const mockCheckMongodump = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("../../../src/infra/command-runner.js", () => ({
  runCommand: mockRunCommand,
}));

jest.unstable_mockModule("execa", () => ({
  execa: mockExeca,
}));

jest.unstable_mockModule("fs", () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

jest.unstable_mockModule(
  "../../../src/infra/engines/mongodb/mongodb-env.js",
  () => ({
    checkMongoshClient: mockCheckMongoshClient,
    checkMongodump: mockCheckMongodump,
  }),
);

// Load after mocks
const { MongodbEngine } =
  await import("../../../src/infra/engines/mongodb/mongodb.engine.js");

// --- Helpers ---

function cmdOk(stdout = ""): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return { stdout, stderr: "", exitCode: 0 };
}

function cmdFail(stderr = "error"): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return { stdout: "", stderr, exitCode: 1 };
}

// --- Tests ---

describe("MongodbEngine", () => {
  let engine: InstanceType<typeof MongodbEngine>;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new MongodbEngine();
  });

  // --- Basic metadata ---

  it("getEngineName() returns MongoDB", () => {
    expect(engine.getEngineName()).toBe("MongoDB");
  });

  it("getDefaultConnectionOptions() returns host and port 27017", () => {
    expect(engine.getDefaultConnectionOptions()).toEqual({
      host: "localhost",
      port: "27017",
    });
  });

  // --- checkClientVersion ---

  it("checkClientVersion() delegates to checkMongoshClient", async () => {
    const result = await engine.checkClientVersion();
    expect(mockCheckMongoshClient).toHaveBeenCalledTimes(1);
    expect(result).toBe("mongosh 2.3.0");
  });

  // --- checkBackupRequirements ---

  it("checkBackupRequirements() delegates to checkMongodump", async () => {
    await engine.checkBackupRequirements();
    expect(mockCheckMongodump).toHaveBeenCalledTimes(1);
  });

  // --- discoverInstances ---

  describe("discoverInstances()", () => {
    it("returns empty array when no ports respond", async () => {
      mockExeca.mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await engine.discoverInstances();
      expect(result).toEqual([]);
    });

    it("returns instances for responsive ports", async () => {
      mockExeca.mockImplementation(async (_bin: unknown, args: unknown) => {
        const argList = args as string[];
        if (argList[0]?.includes(":27017/")) return cmdOk("7.0.5");
        throw new Error("ECONNREFUSED");
      });

      const result = await engine.discoverInstances();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        port: "27017",
        version: "MongoDB 7.0.5",
        status: "running",
      });
    });

    it("sorts instances by port number", async () => {
      mockExeca.mockImplementation(async (_bin: unknown, args: unknown) => {
        const argList = args as string[];
        if (
          argList[0]?.includes(":27017/") ||
          argList[0]?.includes(":27018/")
        ) {
          return cmdOk("7.0.5");
        }
        throw new Error("ECONNREFUSED");
      });

      const result = await engine.discoverInstances();
      expect(result).toHaveLength(2);
      expect(result[0].port).toBe("27017");
      expect(result[1].port).toBe("27018");
    });
  });

  // --- getServerVersion ---

  describe("getServerVersion()", () => {
    it("returns version string on success", async () => {
      mockRunCommand.mockResolvedValue(cmdOk("7.0.5"));
      const result = await engine.getServerVersion();
      expect(result).toBe("MongoDB 7.0.5");
    });

    it("returns null when command fails", async () => {
      mockRunCommand.mockResolvedValue(cmdFail());
      const result = await engine.getServerVersion();
      expect(result).toBeNull();
    });

    it("returns null when stdout is empty", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      const result = await engine.getServerVersion();
      expect(result).toBeNull();
    });

    it("passes correct URI with auth when user and password are set", async () => {
      mockRunCommand.mockResolvedValue(cmdOk("7.0.5"));
      await engine.getServerVersion({
        host: "myhost",
        port: "27099",
        user: "admin",
        password: "secret",
      });
      const [bin, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(bin).toBe("mongosh");
      expect(args[0]).toContain("admin:secret@myhost:27099");
      expect(args[0]).toContain("authSource=admin");
    });

    it("passes URI without auth when only user is set (no password)", async () => {
      mockRunCommand.mockResolvedValue(cmdOk("7.0.5"));
      await engine.getServerVersion({ host: "myhost", user: "admin" });
      const [, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(args[0]).not.toContain("admin@");
    });
  });

  // --- listDatabases ---

  describe("listDatabases()", () => {
    const dbList = JSON.stringify([
      { name: "myapp" },
      { name: "testdb" },
      { name: "admin" },
      { name: "local" },
      { name: "config" },
    ]);

    it("returns user databases, filtering out system databases", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(dbList));
      const result = await engine.listDatabases();
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.name)).toEqual(["myapp", "testdb"]);
    });

    it("returns empty array when output is empty", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      const result = await engine.listDatabases();
      expect(result).toEqual([]);
    });

    it("returns empty array when output is []", async () => {
      mockRunCommand.mockResolvedValue(cmdOk("[]"));
      const result = await engine.listDatabases();
      expect(result).toEqual([]);
    });

    it("includes size when includeSize is true", async () => {
      const withSize = JSON.stringify([{ name: "myapp", size: "512 kB" }]);
      mockRunCommand.mockResolvedValue(cmdOk(withSize));
      const result = await engine.listDatabases({ includeSize: true });
      expect(result[0].size).toBe("512 kB");
    });

    it("throws auth error on authentication failure", async () => {
      mockRunCommand.mockResolvedValue(
        cmdFail("MongoServerError: Authentication failed"),
      );
      await expect(engine.listDatabases()).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("throws generic error on other failures", async () => {
      mockRunCommand.mockResolvedValue(cmdFail("network error"));
      await expect(engine.listDatabases()).rejects.toThrow(
        "Failed to list databases",
      );
    });

    it("throws parse error on invalid JSON", async () => {
      mockRunCommand.mockResolvedValue(cmdOk("not-json"));
      await expect(engine.listDatabases()).rejects.toThrow(
        "Failed to parse database list",
      );
    });
  });

  // --- createDatabase ---

  describe("createDatabase()", () => {
    it("throws if database already exists", async () => {
      mockRunCommand.mockResolvedValue(
        cmdOk(JSON.stringify([{ name: "existing" }])),
      );
      await expect(engine.createDatabase("existing")).rejects.toThrow(
        'Database "existing" already exists.',
      );
    });

    it("creates database when it does not exist", async () => {
      // First call: listDatabases (returns empty), second: mongosh create
      mockRunCommand
        .mockResolvedValueOnce(cmdOk("[]"))
        .mockResolvedValueOnce(cmdOk(""));

      await engine.createDatabase("newdb");

      expect(mockRunCommand).toHaveBeenCalledTimes(2);
      const [bin, args] = mockRunCommand.mock.calls[1] as [string, string[]];
      expect(bin).toBe("mongosh");
      expect(args.some((a) => a.includes("newdb"))).toBe(true);
      expect(args).toContain("--quiet");
    });

    it("throws auth error on authentication failure", async () => {
      mockRunCommand
        .mockResolvedValueOnce(cmdOk("[]"))
        .mockResolvedValueOnce(cmdFail("Unauthorized: command requires auth"));
      await expect(engine.createDatabase("newdb")).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("throws generic error on other failures", async () => {
      mockRunCommand
        .mockResolvedValueOnce(cmdOk("[]"))
        .mockResolvedValueOnce(cmdFail("connection refused"));
      await expect(engine.createDatabase("newdb")).rejects.toThrow(
        'Failed to create database "newdb"',
      );
    });
  });

  // --- dropDatabase ---

  describe("dropDatabase()", () => {
    it("drops the database successfully", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      await engine.dropDatabase("mydb");
      const [bin, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(bin).toBe("mongosh");
      expect(args.some((a) => a.includes("mydb"))).toBe(true);
      expect(args).toContain("--quiet");
    });

    it("throws auth error on authentication failure", async () => {
      mockRunCommand.mockResolvedValue(
        cmdFail("MongoServerError: Authentication failed"),
      );
      await expect(engine.dropDatabase("mydb")).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("throws generic error on other failures", async () => {
      mockRunCommand.mockResolvedValue(cmdFail("network error"));
      await expect(engine.dropDatabase("mydb")).rejects.toThrow(
        'Failed to drop database "mydb"',
      );
    });
  });

  // --- backupDatabase ---

  describe("backupDatabase()", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it("throws for unsupported formats", async () => {
      await expect(
        engine.backupDatabase("mydb", "/tmp", {}, "plain"),
      ).rejects.toThrow('MongoDB does not support "plain" format');
    });

    it("creates output dir if it does not exist", async () => {
      mockExistsSync.mockReturnValue(false);
      mockRunCommand.mockResolvedValue(cmdOk(""));

      await engine.backupDatabase("mydb", "/tmp/backups");
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("backups"),
        { recursive: true },
      );
    });

    it("calls mongodump with correct args", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      await engine.backupDatabase("mydb", "/tmp/backups", {
        host: "dbhost",
        port: "27099",
      });

      const [bin, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(bin).toBe("mongodump");
      expect(args).toContain("--host=dbhost");
      expect(args).toContain("--port=27099");
      expect(args).toContain("--db=mydb");
      expect(args.some((a) => a.startsWith("--archive="))).toBe(true);
      expect(args).toContain("--gzip");
    });

    it("includes auth args when user and password are set", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      await engine.backupDatabase("mydb", "/tmp/backups", {
        user: "admin",
        password: "secret",
      });

      const [, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(args).toContain("--username");
      expect(args).toContain("admin");
      expect(args).toContain("--password");
      expect(args).toContain("secret");
      expect(args).toContain("--authenticationDatabase");
    });

    it("does not include auth args when only user is set (no password)", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      await engine.backupDatabase("mydb", "/tmp/backups", { user: "admin" });

      const [, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(args).not.toContain("--username");
    });

    it("returns the output file path", async () => {
      mockRunCommand.mockResolvedValue(cmdOk(""));
      const result = await engine.backupDatabase("mydb", "/tmp/backups");
      expect(result).toMatch(/mydb_\d{4}-\d{2}-\d{2}\.mongodump$/);
    });

    it("throws on backup failure", async () => {
      mockRunCommand.mockResolvedValue(cmdFail("connection refused"));
      await expect(
        engine.backupDatabase("mydb", "/tmp/backups"),
      ).rejects.toThrow('Backup failed for "mydb"');
    });
  });

  // --- restoreDatabase ---

  describe("restoreDatabase()", () => {
    it("throws when file does not exist", async () => {
      mockExistsSync.mockReturnValue(false);
      await expect(
        engine.restoreDatabase("/tmp/missing.mongodump", "mydb"),
      ).rejects.toThrow("Backup file not found");
    });

    it("calls mongorestore with correct args", async () => {
      mockExistsSync.mockReturnValue(true);
      mockRunCommand.mockResolvedValue(cmdOk(""));

      await engine.restoreDatabase("/tmp/mydb_2026-03-01.mongodump", "mydb", {
        host: "dbhost",
        port: "27099",
      });

      const [bin, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(bin).toBe("mongorestore");
      expect(args).toContain("--host=dbhost");
      expect(args).toContain("--port=27099");
      expect(args).toContain("--archive=/tmp/mydb_2026-03-01.mongodump");
      expect(args).toContain("--gzip");
    });

    it("adds --nsFrom/--nsTo when target DB differs from source", async () => {
      mockExistsSync.mockReturnValue(true);
      mockRunCommand.mockResolvedValue(cmdOk(""));

      await engine.restoreDatabase(
        "/tmp/sourcedb_2026-03-01.mongodump",
        "targetdb",
      );

      const [, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(args).toContain("--nsFrom=sourcedb.*");
      expect(args).toContain("--nsTo=targetdb.*");
    });

    it("does not add --nsFrom/--nsTo when target matches source", async () => {
      mockExistsSync.mockReturnValue(true);
      mockRunCommand.mockResolvedValue(cmdOk(""));

      await engine.restoreDatabase("/tmp/mydb_2026-03-01.mongodump", "mydb");

      const [, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(args.some((a) => a.startsWith("--nsFrom"))).toBe(false);
    });

    it("includes auth args when user and password are set", async () => {
      mockExistsSync.mockReturnValue(true);
      mockRunCommand.mockResolvedValue(cmdOk(""));

      await engine.restoreDatabase("/tmp/mydb_2026-03-01.mongodump", "mydb", {
        user: "admin",
        password: "secret",
      });

      const [, args] = mockRunCommand.mock.calls[0] as [string, string[]];
      expect(args).toContain("--username");
      expect(args).toContain("--password");
    });

    it("throws on restore failure", async () => {
      mockExistsSync.mockReturnValue(true);
      mockRunCommand.mockResolvedValue(cmdFail("connection refused"));
      await expect(
        engine.restoreDatabase("/tmp/mydb_2026-03-01.mongodump", "mydb"),
      ).rejects.toThrow("Restore failed");
    });
  });

  // --- getHealthChecks ---

  describe("getHealthChecks()", () => {
    it("returns 3 health checks", () => {
      const checks = engine.getHealthChecks();
      expect(checks).toHaveLength(3);
      expect(checks.map((c) => c.name)).toEqual([
        "mongosh",
        "mongodump",
        "Connection",
      ]);
    });

    it("mongosh check succeeds when binary exists", async () => {
      mockExeca.mockResolvedValue(cmdOk("mongosh 2.3.0"));
      const checks = engine.getHealthChecks();
      const result = await checks[0].run({});
      expect(result.status).toBe("success");
      expect(result.message).toContain("mongosh");
    });

    it("mongosh check fails when binary is missing", async () => {
      mockExeca.mockRejectedValue(new Error("not found"));
      const checks = engine.getHealthChecks();
      const result = await checks[0].run({});
      expect(result.status).toBe("error");
      expect(result.message).toContain("mongosh is missing");
    });

    it("mongodump check succeeds when binary exists", async () => {
      mockExeca.mockResolvedValue(cmdOk("mongodump version: 100.9.0"));
      const checks = engine.getHealthChecks();
      const result = await checks[1].run({});
      expect(result.status).toBe("success");
      expect(result.message).toContain("mongodump");
    });

    it("mongodump check fails when binary is missing", async () => {
      mockExeca.mockRejectedValue(new Error("not found"));
      const checks = engine.getHealthChecks();
      const result = await checks[1].run({});
      expect(result.status).toBe("error");
      expect(result.message).toContain("mongodump is missing");
    });

    it("Connection check succeeds when server is reachable", async () => {
      mockExeca.mockResolvedValue(cmdOk("7.0.5"));
      const checks = engine.getHealthChecks();
      const result = await checks[2].run({
        host: "localhost",
        port: "27017",
      });
      expect(result.status).toBe("success");
      expect(result.message).toContain("localhost:27017");
    });

    it("Connection check reports auth error", async () => {
      mockExeca.mockRejectedValue(new Error("Authentication failed"));
      const checks = engine.getHealthChecks();
      const result = await checks[2].run({});
      expect(result.status).toBe("error");
      expect(result.message).toContain("Authentication failed");
    });

    it("Connection check reports connection error when server is down", async () => {
      mockExeca.mockRejectedValue(new Error("ECONNREFUSED"));
      const checks = engine.getHealthChecks();
      const result = await checks[2].run({});
      expect(result.status).toBe("error");
      expect(result.message).toContain("Could not connect");
    });
  });
});
