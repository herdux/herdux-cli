import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { existsSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";
import { runCli, SQLITE_DIR, TMP_HOME } from "./helpers/cli.js";

// --- Constants ---

const TEST_DB = "herdux_e2e_testdb";
const BACKUP_DIR = resolve(SQLITE_DIR, "..", "backups");

let customBackupPath: string;
let plainBackupPath: string;

// --- Lifecycle ---

beforeAll(() => {
  if (existsSync(SQLITE_DIR)) rmSync(SQLITE_DIR, { recursive: true });
  if (existsSync(BACKUP_DIR)) rmSync(BACKUP_DIR, { recursive: true });
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });

  mkdirSync(SQLITE_DIR, { recursive: true });
  mkdirSync(BACKUP_DIR, { recursive: true });
  mkdirSync(TMP_HOME, { recursive: true });
});

afterAll(() => {
  if (existsSync(SQLITE_DIR)) rmSync(SQLITE_DIR, { recursive: true });
  if (existsSync(BACKUP_DIR)) rmSync(BACKUP_DIR, { recursive: true });
  if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
});

// --- Tests ---
// Tests run sequentially — order matters for the workflow.

describe("E2E: SQLite Full Workflow", () => {
  // ─── Doctor ───

  describe("doctor", () => {
    it("should verify system health", async () => {
      const result = await runCli("doctor");

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/sqlite3/i);
    });
  });

  // ─── Version ───

  describe("version", () => {
    it("should return the sqlite3 client version", async () => {
      const result = await runCli("version");

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/SQLite/i);
    });
  });

  // ─── Config ───

  describe("config", () => {
    it("should set and retrieve a config value", async () => {
      const setResult = await runCli("config", "set", "output", BACKUP_DIR);
      expect(setResult.exitCode).toBe(0);

      const getResult = await runCli("config", "get", "output");
      expect(getResult.exitCode).toBe(0);
      expect(getResult.output).toContain(BACKUP_DIR);
    });
  });

  // ─── Create ───

  describe("create", () => {
    it("should create a new database file", async () => {
      const result = await runCli("create", TEST_DB);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/created/i);
      expect(existsSync(`${SQLITE_DIR}/${TEST_DB}.db`)).toBe(true);
    });

    it("should fail if the database already exists", async () => {
      const result = await runCli("create", TEST_DB);

      expect(result.exitCode).toBe(1);
      expect(result.output).toMatch(/already exists/i);
    });
  });

  // ─── List ───

  describe("list", () => {
    it("should list the created database", async () => {
      const result = await runCli("list");

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain(TEST_DB);
    });
  });

  // ─── Backup (custom format) ───

  describe("backup (custom format)", () => {
    it("should create a .db backup file", async () => {
      const result = await runCli(
        "backup",
        TEST_DB,
        "--output",
        BACKUP_DIR,
        "--format",
        "custom",
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/Backup saved/i);

      // Extract backup path from output
      const match = result.output.match(/Backup saved at (.+\.db)/);
      expect(match).not.toBeNull();
      customBackupPath = match![1].trim();
      expect(existsSync(customBackupPath)).toBe(true);
    });
  });

  // ─── Backup (plain format) ───

  describe("backup (plain format)", () => {
    it("should create a .sql dump file", async () => {
      const result = await runCli(
        "backup",
        TEST_DB,
        "--output",
        BACKUP_DIR,
        "--format",
        "plain",
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/Backup saved/i);

      const match = result.output.match(/Backup saved at (.+\.sql)/);
      expect(match).not.toBeNull();
      plainBackupPath = match![1].trim();
      expect(existsSync(plainBackupPath)).toBe(true);
    });
  });

  // ─── Drop ───

  describe("drop", () => {
    it("should drop the database with --yes flag", async () => {
      const result = await runCli("drop", TEST_DB, "--yes");

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/dropped/i);
      expect(existsSync(`${SQLITE_DIR}/${TEST_DB}.db`)).toBe(false);
    });
  });

  // ─── Restore (from .db file) ───

  describe("restore (from .db backup)", () => {
    it("should restore the database from the .db backup", async () => {
      const result = await runCli("restore", customBackupPath, "--db", TEST_DB);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/restored/i);
      expect(existsSync(`${SQLITE_DIR}/${TEST_DB}.db`)).toBe(true);
    });
  });

  // ─── Drop again (cleanup before plain restore) ───

  describe("drop (cleanup before plain restore)", () => {
    it("should drop the database again", async () => {
      const result = await runCli("drop", TEST_DB, "--yes");
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Restore (from .sql file) ───

  describe("restore (from .sql dump)", () => {
    it("should restore the database from the .sql dump", async () => {
      const result = await runCli("restore", plainBackupPath, "--db", TEST_DB);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/restored/i);
      expect(existsSync(`${SQLITE_DIR}/${TEST_DB}.db`)).toBe(true);
    });
  });

  // ─── Final drop (cleanup) ───

  describe("drop (final cleanup)", () => {
    it("should drop the test database", async () => {
      const result = await runCli("drop", TEST_DB, "--yes");

      expect(result.exitCode).toBe(0);
    });
  });
});
