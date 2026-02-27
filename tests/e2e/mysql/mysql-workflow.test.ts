import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { startContainer, stopContainer } from "./helpers/docker.js";
import { runCli } from "./helpers/cli.js";

// --- Constants ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB = "herdux_mysql_testdb";
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..");
const BACKUP_DIR = resolve(PROJECT_ROOT, "tests", "e2e", "mysql", "backups");
const TMP_HOME = resolve(PROJECT_ROOT, "tests", "e2e", "mysql", ".tmp-home");

// Track backup file paths for restore tests
let sqlBackupPath: string;

// --- Lifecycle ---

beforeAll(async () => {
  // Clean up previous runs
  if (existsSync(BACKUP_DIR)) rmSync(BACKUP_DIR, { recursive: true });
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
  mkdirSync(BACKUP_DIR, { recursive: true });
  mkdirSync(TMP_HOME, { recursive: true });

  await startContainer();
}, 120_000);

afterAll(async () => {
  await stopContainer();

  // Clean up temp directories
  if (existsSync(BACKUP_DIR)) rmSync(BACKUP_DIR, { recursive: true });
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
}, 120_000);

// --- Tests ---
// Tests are designed to run sequentially (Jest default for a single file).

describe("E2E: MySQL Full Workflow", () => {
  // ─── Doctor ───

  describe("doctor", () => {
    it("should verify system health for MySQL", async () => {
      const result = await runCli("doctor");

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("mysql");
      expect(result.output).toContain("mysqldump");
    });
  });

  // ─── Version ───

  describe("version", () => {
    it("should display CLI and server version", async () => {
      const result = await runCli("version");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/herdux/i);
    });
  });

  describe("create", () => {
    it("should create a new database", async () => {
      // Add a slight delay because the previous `version` command runs a port scan.
      // In WSL/Docker, rapid sequential connections from the scan followed immediately
      // by a new connection attempt can cause `EAGAIN (System Error 11: Lost connection)`.
      await new Promise((r) => setTimeout(r, 1500));

      const result = await runCli("create", TEST_DB);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain(TEST_DB);
      expect(result.output).toMatch(/created/i);
    });

    it("should fail to create a database that already exists", async () => {
      const result = await runCli("create", TEST_DB);

      expect(result.exitCode).not.toBe(0);
    });
  });

  // ─── List ───

  describe("list", () => {
    it("should list databases and include the test database", async () => {
      const result = await runCli("list");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(TEST_DB);
    });

    it("should list databases with size information", async () => {
      const result = await runCli("list", "--size");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(TEST_DB);
      expect(result.stdout).toMatch(/SIZE/i);
    });
  });

  // ─── Backup (plain / mysqldump default) ───

  describe("backup", () => {
    it("should create a backup in plain SQL format", async () => {
      const result = await runCli(
        "backup",
        TEST_DB,
        "--format",
        "plain",
        "--output",
        BACKUP_DIR,
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/backup saved/i);

      const files = readdirSync(BACKUP_DIR);
      const sqlFile = files.find((f) => f.endsWith(".sql"));
      expect(sqlFile).toBeDefined();
      sqlBackupPath = resolve(BACKUP_DIR, sqlFile!);
    });
  });

  // ─── Drop ───

  describe("drop", () => {
    it("should drop the database with --yes flag", async () => {
      const result = await runCli("drop", TEST_DB, "--yes");

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/dropped/i);
    });

    it("should confirm the database no longer exists", async () => {
      const result = await runCli("list");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain(TEST_DB);
    });
  });

  // ─── Restore ───

  describe("restore", () => {
    it("should restore the database from .sql backup", async () => {
      const result = await runCli("restore", sqlBackupPath, "--db", TEST_DB);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/restored/i);
    });

    it("should confirm the database exists after restore", async () => {
      const result = await runCli("list");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(TEST_DB);
    });
  });

  // ─── Final cleanup ───

  describe("cleanup", () => {
    it("should drop the test database to leave a clean state", async () => {
      const result = await runCli("drop", TEST_DB, "--yes");

      expect(result.exitCode).toBe(0);
    });
  });
});
