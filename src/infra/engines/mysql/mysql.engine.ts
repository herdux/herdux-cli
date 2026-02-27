import { runCommand } from "../../command-runner.js";
import type {
  IDatabaseEngine,
  ConnectionOptions,
  DatabaseInstance,
  DatabaseInfo,
  HealthCheck,
} from "../../../core/interfaces/database-engine.interface.js";
import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { execa } from "execa";
import { checkMysqlClient, checkMysqlDump } from "./mysql-env.js";

// --- Internal Helpers ---

async function checkBin(
  binName: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const result = await execa(binName, ["--version"], { timeout: 5000 });
    return { ok: true, version: result.stdout.trim().split("\n")[0] };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

function buildConnectionArgs(opts: ConnectionOptions): string[] {
  const args: string[] = ["--protocol=tcp"];
  if (opts.host) args.push("-h", opts.host);
  if (opts.port) args.push("-P", opts.port);
  if (opts.user) args.push("-u", opts.user);
  return args;
}

function buildEnv(opts: ConnectionOptions): Record<string, string> {
  const env: Record<string, string> = {};
  if (opts.password) env["MYSQL_PWD"] = opts.password;
  return env;
}

function generateBackupFilename(dbName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${dbName}_${date}.sql`;
}

const DEFAULT_SCAN_PORTS = ["3306", "3307", "3308", "3309", "3310"];

// --- MysqlEngine ---

export class MysqlEngine implements IDatabaseEngine {
  getHealthChecks(): HealthCheck[] {
    return [
      {
        name: "mysql",
        pendingMessage: "Checking mysql client...",
        run: async () => {
          const res = await checkBin("mysql");
          if (res.ok)
            return {
              status: "success",
              message: `mysql client is installed: ${res.version}`,
            };
          return {
            status: "error",
            message: `mysql client is missing. Please install MySQL client tools.`,
          };
        },
      },
      {
        name: "mysqldump",
        pendingMessage: "Checking mysqldump...",
        run: async () => {
          const res = await checkBin("mysqldump");
          if (res.ok)
            return {
              status: "success",
              message: `mysqldump is installed: ${res.version}`,
            };
          return {
            status: "error",
            message: `mysqldump is missing. Backups will not work.`,
          };
        },
      },
      {
        name: "Connection",
        pendingMessage: "Testing database connection...",
        run: async (opts) => {
          try {
            const env: Record<string, string> = {};
            if (opts.password) env.MYSQL_PWD = opts.password;

            const args = [
              "--protocol=tcp",
              "-h",
              opts.host ?? "localhost",
              "-P",
              opts.port ?? "3306",
              "-u",
              opts.user ?? "root",
              "-e",
              "SELECT 1;",
              "--skip-column-names",
              "--batch",
            ];
            const result = await execa("mysql", args, { env, timeout: 5000 });

            if (result.exitCode === 0) {
              return {
                status: "success",
                message: `Successfully connected to MySQL at ${opts.host ?? "localhost"}:${opts.port ?? "3306"}`,
              };
            }
            return {
              status: "error",
              message: `Connection check returned exit code ${result.exitCode}`,
            };
          } catch (err: any) {
            if (
              err.message.includes("Access denied") ||
              err.message.includes("authentication")
            ) {
              return {
                status: "error",
                message: `Access denied for user '${opts.user ?? "root"}'`,
              };
            }
            return {
              status: "error",
              message: `Could not connect to the database. Make sure MySQL is running and port is open.`,
            };
          }
        },
      },
    ];
  }

  getEngineName(): string {
    return "MySQL";
  }

  getDefaultConnectionOptions(): ConnectionOptions {
    return { host: "localhost", port: "3306", user: "root" };
  }

  async checkClientVersion(): Promise<string> {
    return await checkMysqlClient();
  }

  async checkBackupRequirements(): Promise<void> {
    await checkMysqlDump();
  }

  async discoverInstances(
    opts: ConnectionOptions = {},
  ): Promise<DatabaseInstance[]> {
    const instances: DatabaseInstance[] = [];
    const host = opts.host ?? "localhost";

    const checks = DEFAULT_SCAN_PORTS.map(async (port) => {
      try {
        const args = [
          "--protocol=tcp",
          "-h",
          host,
          "-P",
          port,
          "-u",
          opts.user ?? "root",
          "-e",
          "SELECT VERSION();",
          "--skip-column-names",
          "--batch",
        ];

        const result = await execa("mysql", args, {
          env: buildEnv(opts),
          timeout: 3000,
        });

        if (result.exitCode === 0) {
          const version = result.stdout.trim() || "running";
          instances.push({
            port,
            version: `MySQL ${version}`,
            status: "running",
          });
        }
      } catch {
        // Port not available — skip
      }
    });

    await Promise.all(checks);
    instances.sort((a, b) => parseInt(a.port) - parseInt(b.port));

    return instances;
  }

  async getServerVersion(opts: ConnectionOptions = {}): Promise<string | null> {
    const args = [
      ...buildConnectionArgs(opts),
      "-e",
      "SELECT VERSION();",
      "--skip-column-names",
      "--batch",
    ];

    const result = await runCommand("mysql", args, {
      env: buildEnv(opts),
      timeout: 5000,
    });

    if (result.exitCode !== 0) {
      return null;
    }

    const output = result.stdout.trim();
    return output ? `MySQL ${output}` : null;
  }

  async listDatabases(
    opts: ConnectionOptions & { includeSize?: boolean } = {},
  ): Promise<DatabaseInfo[]> {
    let query: string;

    if (opts.includeSize) {
      query = `SELECT JSON_ARRAYAGG(JSON_OBJECT('name', schema_name, 'encoding', default_character_set_name, 'size', size)) FROM (SELECT s.schema_name, s.default_character_set_name, CONCAT(ROUND(SUM(IFNULL(t.data_length + t.index_length, 0)) / 1024), ' kB') AS size FROM information_schema.schemata s LEFT JOIN information_schema.tables t ON t.table_schema = s.schema_name WHERE s.schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') GROUP BY s.schema_name, s.default_character_set_name ORDER BY SUM(IFNULL(t.data_length + t.index_length, 0)) DESC) AS sorted_dbs;`;
    } else {
      query = `SELECT JSON_ARRAYAGG(JSON_OBJECT('name', schema_name, 'encoding', default_character_set_name)) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys');`;
    }

    const args = [
      ...buildConnectionArgs(opts),
      "-e",
      query,
      "--skip-column-names",
      "--batch",
    ];

    const result = await runCommand("mysql", args, {
      env: buildEnv(opts),
      timeout: opts.includeSize ? 0 : 60000,
    });

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (
        errMsg.includes("Access denied") ||
        errMsg.includes("authentication")
      ) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --engine mysql --password <password> list`,
        );
      }
      throw new Error(`Failed to list databases: ${errMsg}`);
    }

    const output = result.stdout.trim();

    if (!output || output === "" || output === "null" || output === "NULL") {
      return [];
    }

    try {
      return JSON.parse(output) as DatabaseInfo[];
    } catch {
      throw new Error(`Failed to parse database list: ${output}`);
    }
  }

  async createDatabase(
    name: string,
    opts: ConnectionOptions = {},
  ): Promise<void> {
    const args = [
      ...buildConnectionArgs(opts),
      "-e",
      `CREATE DATABASE \`${name}\`;`,
    ];

    const result = await runCommand("mysql", args, {
      env: buildEnv(opts),
    });

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (
        errMsg.includes("Access denied") ||
        errMsg.includes("authentication")
      ) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --engine mysql --password <password> create "${name}"`,
        );
      }
      throw new Error(`Failed to create database "${name}": ${errMsg}`);
    }
  }

  async dropDatabase(
    name: string,
    opts: ConnectionOptions = {},
  ): Promise<void> {
    const args = [
      ...buildConnectionArgs(opts),
      "-e",
      `DROP DATABASE \`${name}\`;`,
    ];

    const result = await runCommand("mysql", args, {
      env: buildEnv(opts),
    });

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (
        errMsg.includes("Access denied") ||
        errMsg.includes("authentication")
      ) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --engine mysql --password <password> drop "${name}"`,
        );
      }
      throw new Error(`Failed to drop database "${name}": ${errMsg}`);
    }
  }

  async backupDatabase(
    dbName: string,
    outputDir: string = "./backups",
    opts: ConnectionOptions = {},
    _format: string = "plain",
  ): Promise<string> {
    const resolvedDir = resolve(outputDir);

    if (!existsSync(resolvedDir)) {
      mkdirSync(resolvedDir, { recursive: true });
    }

    const filename = generateBackupFilename(dbName);
    const outputPath = join(resolvedDir, filename);

    const args = [
      ...buildConnectionArgs(opts),
      "--result-file",
      outputPath,
      dbName,
    ];

    const result = await runCommand("mysqldump", args, {
      env: buildEnv(opts),
      timeout: 0,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Backup failed for "${dbName}": ${result.stderr}`);
    }

    return outputPath;
  }

  async restoreDatabase(
    inputPath: string,
    dbName: string,
    opts: ConnectionOptions = {},
    _format?: string,
    _clean?: boolean,
  ): Promise<{ hasWarnings: boolean; warnings?: string } | void> {
    const resolvedPath = resolve(inputPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Backup file not found: ${resolvedPath}`);
    }

    // For MySQL, first ensure the database exists
    try {
      await this.createDatabase(dbName, opts);
    } catch {
      // Database might already exist — that's fine
    }

    const args = [...buildConnectionArgs(opts), dbName];

    const result = await runCommand("mysql", args, {
      env: buildEnv(opts),
      timeout: 0,
      stdin: resolvedPath,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Restore failed: ${result.stderr}`);
    }
  }
}
