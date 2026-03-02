import { CliRunner } from "../helpers/cli-runner.js";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("CLI Integration: hdx inspect", () => {
  let runner: CliRunner;
  let fileDir: string;

  beforeEach(() => {
    runner = new CliRunner();
    fileDir = mkdtempSync(join(tmpdir(), "herdux-inspect-test-"));
  });

  afterEach(() => {
    runner.cleanup();
    rmSync(fileDir, { recursive: true, force: true });
  });

  it("extracts CREATE statements from a .sql file and exits 0", async () => {
    const sqlPath = join(fileDir, "export.sql");
    writeFileSync(
      sqlPath,
      [
        "-- Dumped by mysqldump",
        "CREATE TABLE users (",
        "  id INT PRIMARY KEY,",
        "  name VARCHAR(255)",
        ");",
        "",
        "CREATE INDEX idx_users_name ON users (name);",
        "",
        "INSERT INTO users VALUES (1, 'Alice');",
      ].join("\n"),
      "utf-8",
    );

    const result = await runner.run(["inspect", sqlPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CREATE TABLE users");
    expect(result.stdout).toContain("CREATE INDEX idx_users_name");
    // INSERT statements must not appear — only DDL is extracted
    expect(result.stdout).not.toContain("INSERT INTO");
  });

  it("returns a helpful message when the .sql file has no CREATE statements", async () => {
    const sqlPath = join(fileDir, "data-only.sql");
    writeFileSync(
      sqlPath,
      ["INSERT INTO users VALUES (1, 'Alice');", ""].join("\n"),
      "utf-8",
    );

    const result = await runner.run(["inspect", sqlPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no CREATE statements found");
  });

  it("exits 1 with a clear error when the file does not exist", async () => {
    const result = await runner.run([
      "inspect",
      "/nonexistent/path/backup.sql",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("File not found");
  });

  it("exits 1 with a clear error for unsupported file extensions", async () => {
    const bakPath = join(fileDir, "archive.bak");
    writeFileSync(bakPath, "binary content", "utf-8");

    const result = await runner.run(["inspect", bakPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unsupported file type");
    expect(result.stderr).toContain(".dump");
    expect(result.stderr).toContain(".sql");
    expect(result.stderr).toContain(".db");
  });
});
