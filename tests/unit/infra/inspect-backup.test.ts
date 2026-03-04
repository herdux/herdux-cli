import { jest } from "@jest/globals";

// --- Mocks ---

const mockExistsSync = jest.fn<() => boolean>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFileSync = jest.fn<() => any>();

jest.unstable_mockModule("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

const mockExeca =
  jest.fn<
    () => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >();

jest.unstable_mockModule("execa", () => ({
  execa: mockExeca,
}));

// Load module after mocks
const { inspectBackupFile } =
  await import("../../../src/infra/engines/inspect-backup.js");

// --- Helpers ---

function execaOk(stdout = ""): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return { stdout, stderr: "", exitCode: 0 };
}

function execaFail(stderr = "error"): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return { stdout: "", stderr, exitCode: 1 };
}

// --- Tests ---

describe("inspectBackupFile()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  // --- File not found ---

  it("throws when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await expect(inspectBackupFile("/tmp/missing.dump")).rejects.toThrow(
      "File not found",
    );
    expect(mockExeca).not.toHaveBeenCalled();
  });

  // --- .dump ---

  it("calls pg_restore --list for .dump files", async () => {
    mockExeca.mockResolvedValue(
      execaOk("; Archive created\n; TOC entry: TABLE public users"),
    );

    const result = await inspectBackupFile("/tmp/backup.dump");

    expect(mockExeca).toHaveBeenCalledWith(
      "pg_restore",
      ["--list", expect.stringContaining("backup.dump")],
      { reject: false },
    );
    expect(result).toContain("TOC entry");
  });

  it("throws when pg_restore fails on a .dump file", async () => {
    mockExeca.mockResolvedValue(
      execaFail("pg_restore: error: invalid magic number"),
    );

    await expect(inspectBackupFile("/tmp/bad.dump")).rejects.toThrow(
      "pg_restore failed",
    );
  });

  // --- .tar ---

  it("calls pg_restore --list for .tar files", async () => {
    mockExeca.mockResolvedValue(execaOk("; Archive\n; TABLE public orders"));

    const result = await inspectBackupFile("/tmp/backup.tar");

    expect(mockExeca).toHaveBeenCalledWith(
      "pg_restore",
      ["--list", expect.stringContaining("backup.tar")],
      { reject: false },
    );
    expect(result).toContain("TABLE public orders");
  });

  it("throws when pg_restore fails on a .tar file", async () => {
    mockExeca.mockResolvedValue(
      execaFail("pg_restore: error: unsupported version"),
    );

    await expect(inspectBackupFile("/tmp/bad.tar")).rejects.toThrow(
      "pg_restore failed",
    );
  });

  // --- .sql ---

  it("extracts CREATE TABLE statements from a .sql file", async () => {
    mockReadFileSync.mockReturnValue(
      "-- comment\nCREATE TABLE users (\n  id serial PRIMARY KEY\n);\n",
    );

    const result = await inspectBackupFile("/tmp/backup.sql");

    expect(mockExeca).not.toHaveBeenCalled();
    expect(result).toContain("CREATE TABLE users");
  });

  it("returns empty message when .sql file has no CREATE statements", async () => {
    mockReadFileSync.mockReturnValue(
      "-- just comments\nSET standard_conforming_strings = on;\n",
    );

    const result = await inspectBackupFile("/tmp/empty.sql");

    expect(result).toContain("no CREATE statements found");
  });

  it("extracts CREATE INDEX from a .sql file", async () => {
    mockReadFileSync.mockReturnValue(
      "CREATE INDEX idx_users_email ON users (email);\n",
    );

    const result = await inspectBackupFile("/tmp/backup.sql");

    expect(result).toContain("CREATE INDEX idx_users_email");
  });

  it("extracts CREATE VIEW from a .sql file", async () => {
    mockReadFileSync.mockReturnValue(
      "CREATE VIEW active_users AS SELECT * FROM users WHERE active = true;\n",
    );

    const result = await inspectBackupFile("/tmp/backup.sql");

    expect(result).toContain("CREATE VIEW active_users");
  });

  // --- .db / .sqlite ---

  it("calls sqlite3 .schema for .db files", async () => {
    mockExeca.mockResolvedValue(
      execaOk("CREATE TABLE tasks (id INTEGER PRIMARY KEY);"),
    );

    const result = await inspectBackupFile("/tmp/mydb.db");

    expect(mockExeca).toHaveBeenCalledWith(
      "sqlite3",
      [expect.stringContaining("mydb.db"), ".schema"],
      { reject: false },
    );
    expect(result).toContain("CREATE TABLE tasks");
  });

  it("calls sqlite3 .schema for .sqlite files", async () => {
    mockExeca.mockResolvedValue(execaOk("CREATE TABLE items (id INTEGER);"));

    const result = await inspectBackupFile("/tmp/data.sqlite");

    expect(mockExeca).toHaveBeenCalledWith(
      "sqlite3",
      [expect.stringContaining("data.sqlite"), ".schema"],
      { reject: false },
    );
    expect(result).toContain("CREATE TABLE items");
  });

  it("returns empty database message when sqlite3 returns blank output", async () => {
    mockExeca.mockResolvedValue(execaOk(""));

    const result = await inspectBackupFile("/tmp/empty.db");

    expect(result).toContain("empty database");
  });

  it("throws when sqlite3 fails", async () => {
    mockExeca.mockResolvedValue(execaFail("unable to open database file"));

    await expect(inspectBackupFile("/tmp/bad.db")).rejects.toThrow(
      "sqlite3 failed",
    );
  });

  // --- .mongodump ---

  it("returns archive info for .mongodump files without a live connection", async () => {
    // Valid gzip magic bytes (1f 8b) followed by padding
    mockReadFileSync.mockReturnValue(
      Buffer.from([0x1f, 0x8b, 0x00, 0x00, 0x00]),
    );

    const result = await inspectBackupFile("/tmp/mydb_2026-03-01.mongodump");

    expect(mockExeca).not.toHaveBeenCalled();
    expect(result).toContain("mydb_2026-03-01.mongodump");
    expect(result).toContain("MongoDB archive");
    expect(result).toContain("mydb");
  });

  it("throws when .mongodump file is not a valid gzip archive", async () => {
    mockReadFileSync.mockReturnValue(Buffer.from([0x00, 0x00, 0x00]));

    await expect(inspectBackupFile("/tmp/bad.mongodump")).rejects.toThrow(
      "Not a valid mongodump archive",
    );
  });

  it("shows size in the .mongodump archive info", async () => {
    const buf = Buffer.alloc(2048);
    buf[0] = 0x1f;
    buf[1] = 0x8b;
    mockReadFileSync.mockReturnValue(buf);

    const result = await inspectBackupFile("/tmp/mydb.mongodump");

    expect(result).toMatch(/\d+(\.\d+)? KB/);
  });

  // --- Unsupported extension ---

  it("throws for unsupported file extensions with the full list", async () => {
    await expect(inspectBackupFile("/tmp/backup.bak")).rejects.toThrow(
      'Unsupported file type ".bak"',
    );
    await expect(inspectBackupFile("/tmp/backup.bak")).rejects.toThrow(
      ".dump / .tar",
    );
    await expect(inspectBackupFile("/tmp/backup.bak")).rejects.toThrow(
      ".mongodump",
    );
  });
});
