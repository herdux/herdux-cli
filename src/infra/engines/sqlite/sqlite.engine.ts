import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  copyFileSync,
  writeFileSync,
} from "fs";
import { join, resolve, basename, extname } from "path";
import { homedir } from "os";
import { runCommand } from "../../command-runner.js";
import type {
  IDatabaseEngine,
  ConnectionOptions,
  DatabaseInstance,
  DatabaseInfo,
  HealthCheck,
} from "../../../core/interfaces/database-engine.interface.js";
import { checkSqliteClient } from "./sqlite-env.js";

// --- Internal Helpers ---

function defaultDbDir(): string {
  return join(homedir(), ".herdux", "sqlite");
}

function resolveDbDir(opts: ConnectionOptions): string {
  return opts.host ? resolve(opts.host) : defaultDbDir();
}

function resolveDbPath(name: string, opts: ConnectionOptions): string {
  return join(resolveDbDir(opts), `${name}.db`);
}

function generateBackupFilename(
  dbName: string,
  format: "custom" | "plain",
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${dbName}_${date}.${format === "plain" ? "sql" : "db"}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- SqliteEngine ---

export class SqliteEngine implements IDatabaseEngine {
  getHealthChecks(): HealthCheck[] {
    return [
      {
        name: "sqlite3",
        pendingMessage: "Checking sqlite3...",
        run: async () => {
          try {
            const result = await runCommand("sqlite3", ["--version"]);
            if (result.exitCode === 0) {
              return {
                status: "success",
                message: `sqlite3 is installed: ${result.stdout.trim().split("\n")[0]}`,
              };
            }
            return {
              status: "error",
              message: "sqlite3 returned a non-zero exit code.",
            };
          } catch {
            return {
              status: "error",
              message:
                "sqlite3 is missing. Install it: apt install sqlite3 / brew install sqlite",
            };
          }
        },
      },
      {
        name: "Database directory",
        pendingMessage: "Checking database directory...",
        run: async (opts) => {
          const dbDir = resolveDbDir(opts);
          try {
            if (!existsSync(dbDir)) {
              mkdirSync(dbDir, { recursive: true });
            }
            return {
              status: "success",
              message: `Database directory is accessible: ${dbDir}`,
            };
          } catch (err: any) {
            return {
              status: "error",
              message: `Cannot access database directory "${dbDir}": ${err.message}`,
            };
          }
        },
      },
    ];
  }

  getEngineName(): string {
    return "SQLite";
  }

  getDefaultConnectionOptions(): ConnectionOptions {
    return { host: defaultDbDir() };
  }

  async checkClientVersion(): Promise<string> {
    return await checkSqliteClient();
  }

  async checkBackupRequirements(): Promise<void> {
    // SQLite backups use Node.js fs (file copy) or sqlite3 .dump.
    // sqlite3 is already validated in checkClientVersion — nothing else needed.
  }

  async discoverInstances(
    _opts?: ConnectionOptions,
  ): Promise<DatabaseInstance[]> {
    // SQLite is file-based and has no running server instances.
    return [];
  }

  async getServerVersion(_opts?: ConnectionOptions): Promise<string | null> {
    const result = await runCommand("sqlite3", ["--version"]);
    if (result.exitCode !== 0) return null;
    return `SQLite ${result.stdout.trim().split("\n")[0]}`;
  }

  async listDatabases(
    opts: ConnectionOptions & { includeSize?: boolean } = {},
  ): Promise<DatabaseInfo[]> {
    const dbDir = resolveDbDir(opts);

    if (!existsSync(dbDir)) {
      return [];
    }

    const entries = readdirSync(dbDir);
    const databases: DatabaseInfo[] = [];

    for (const entry of entries) {
      const ext = extname(entry).toLowerCase();
      if (ext !== ".db" && ext !== ".sqlite") continue;

      const name = basename(entry, ext);
      const info: DatabaseInfo = { name };

      if (opts.includeSize) {
        try {
          const stat = statSync(join(dbDir, entry));
          info.size = formatFileSize(stat.size);
        } catch {
          info.size = "unknown";
        }
      }

      databases.push(info);
    }

    return databases.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createDatabase(
    name: string,
    opts: ConnectionOptions = {},
  ): Promise<void> {
    const dbDir = resolveDbDir(opts);

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, `${name}.db`);

    if (existsSync(dbPath)) {
      throw new Error(`Database "${name}" already exists at ${dbPath}`);
    }

    // Running sqlite3 with an empty command creates a valid empty database file.
    const result = await runCommand("sqlite3", [dbPath, ""]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create database "${name}": ${result.stderr}`);
    }
  }

  async dropDatabase(
    name: string,
    opts: ConnectionOptions = {},
  ): Promise<void> {
    const dbPath = resolveDbPath(name, opts);

    if (!existsSync(dbPath)) {
      throw new Error(`Database "${name}" not found at ${dbPath}`);
    }

    unlinkSync(dbPath);
  }

  async backupDatabase(
    dbName: string,
    outputDir: string,
    opts: ConnectionOptions = {},
    format: string = "custom",
  ): Promise<string> {
    const dbPath = resolveDbPath(dbName, opts);

    if (!existsSync(dbPath)) {
      throw new Error(`Database "${dbName}" not found at ${dbPath}`);
    }

    const resolvedDir = resolve(outputDir);
    if (!existsSync(resolvedDir)) {
      mkdirSync(resolvedDir, { recursive: true });
    }

    const typedFormat = format === "plain" ? "plain" : "custom";
    const filename = generateBackupFilename(dbName, typedFormat);
    const outputPath = join(resolvedDir, filename);

    if (typedFormat === "plain") {
      // SQL dump via sqlite3 .dump
      const result = await runCommand("sqlite3", [dbPath, ".dump"], {
        timeout: 0,
      });
      if (result.exitCode !== 0) {
        throw new Error(`Backup failed for "${dbName}": ${result.stderr}`);
      }
      writeFileSync(outputPath, result.stdout, "utf8");
    } else {
      // Binary copy of the .db file
      copyFileSync(dbPath, outputPath);
    }

    return outputPath;
  }

  async restoreDatabase(
    filePath: string,
    dbName: string,
    opts: ConnectionOptions = {},
  ): Promise<{ hasWarnings: boolean; warnings?: string } | void> {
    const resolvedPath = resolve(filePath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Backup file not found: ${resolvedPath}`);
    }

    const dbDir = resolveDbDir(opts);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const targetPath = join(dbDir, `${dbName}.db`);
    const ext = extname(resolvedPath).toLowerCase();
    const isPlain = ext === ".sql" || ext === ".txt";

    if (isPlain) {
      // Restore from SQL dump: sqlite3 target.db < backup.sql
      const result = await runCommand("sqlite3", [targetPath], {
        stdin: resolvedPath,
        timeout: 0,
      });
      if (result.exitCode !== 0) {
        throw new Error(`Restore failed: ${result.stderr}`);
      }
    } else {
      // Restore from .db file copy
      copyFileSync(resolvedPath, targetPath);
    }
  }
}
