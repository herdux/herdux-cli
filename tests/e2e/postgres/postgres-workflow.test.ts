import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { startContainer, stopContainer } from "./helpers/docker.js";
import { runCli } from "./helpers/cli.js";

// --- Constants ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB = "herdux_integration_testdb";
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..");
const BACKUP_DIR = resolve(
  PROJECT_ROOT,
  "tests",
  "e2e",
  "postgres",
  "backups",
);
const TMP_HOME = resolve(
  PROJECT_ROOT,
  "tests",
  "e2e",
  "postgres",
  ".tmp-home",
);

// Track backup file paths for restore tests
let customBackupPath: string;
let plainBackupPath: string;

// --- Lifecycle ---

beforeAll(async () => {
  // Clean up previous runs
  if (existsSync(BACKUP_DIR)) rmSync(BACKUP_DIR, { recursive: true });
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
  mkdirSync(BACKUP_DIR, { recursive: true });
  mkdirSync(TMP_HOME, { recursive: true });

  await startContainer();
});

afterAll(async () => {
  await stopContainer();

  // Clean up temp directories
  if (existsSync(BACKUP_DIR)) rmSync(BACKUP_DIR, { recursive: true });
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
});

// --- Tests ---
// Tests are designed to run sequentially (Jest default for a single file).

describe("E2E: PostgreSQL Full Workflow", () => {
  // ─── Doctor ───

  describe("doctor", () => {
    it("should verify system health", async () => {
      const result = await runCli("doctor");

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("psql");
      expect(result.output).toContain("pg_dump");
      expect(result.output).toContain("pg_restore");
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

  // ─── Config ───

  describe("config", () => {
    it("should set and get a config value", async () => {
      const setResult = await runCli("config", "set", "port", "9999");
      expect(setResult.exitCode).toBe(0);

      const getResult = await runCli("config", "get", "port");
      expect(getResult.exitCode).toBe(0);
      expect(getResult.stdout).toContain("9999");
    });

    it("should list configuration", async () => {
      const result = await runCli("config", "list");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("9999");
    });

    it("should reset configuration", async () => {
      const resetResult = await runCli("config", "reset");
      expect(resetResult.exitCode).toBe(0);
    });
  });

  // ─── Create ───

  describe("create", () => {
    it("should create a new database", async () => {
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

  // ─── Backup (custom format) ───

  describe("backup (custom)", () => {
    it("should create a backup in custom format (.dump)", async () => {
      const result = await runCli(
        "backup",
        TEST_DB,
        "--format",
        "custom",
        "--output",
        BACKUP_DIR,
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/backup saved/i);

      const files = readdirSync(BACKUP_DIR);
      const dumpFile = files.find((f) => f.endsWith(".dump"));
      expect(dumpFile).toBeDefined();
      customBackupPath = resolve(BACKUP_DIR, dumpFile!);
    });
  });

  // ─── Backup --drop --yes ───

  describe("backup --drop --yes", () => {
    it("should backup and immediately drop the database", async () => {
      const result = await runCli(
        "backup",
        TEST_DB,
        "--drop",
        "--yes",
        "--output",
        BACKUP_DIR,
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/backup saved/i);
      expect(result.output).toMatch(/dropped/i);
    });

    it("should confirm the database no longer exists", async () => {
      const result = await runCli("list");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain(TEST_DB);
    });
  });

  // ─── Restore (custom format) ───

  describe("restore (custom)", () => {
    it("should restore the database from .dump backup", async () => {
      const result = await runCli(
        "restore",
        customBackupPath,
        "--db",
        TEST_DB,
      );

      // The CLI should handle the pg_restore exit code 1 gracefully and return 0
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/completed with warnings/i);
    });

    it("should confirm the database exists again after restore", async () => {
      const result = await runCli("list");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(TEST_DB);
    });
  });

  // ─── Backup (plain format) ───

  describe("backup (plain)", () => {
    it("should create a backup in plain format (.sql)", async () => {
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
      plainBackupPath = resolve(BACKUP_DIR, sqlFile!);
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

  // ─── Restore (plain format) ───

  describe("restore (plain)", () => {
    it("should restore the database from .sql backup", async () => {
      const result = await runCli("restore", plainBackupPath, "--db", TEST_DB);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/restored/i);
    });

    it("should confirm the database exists after plain restore", async () => {
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
