import { runCommand } from "../../command-runner.js";
import { getScanPorts } from "../../config/config.service.js";
import type {
  IDatabaseEngine,
  ConnectionOptions,
  DatabaseInstance,
  DatabaseInfo,
} from "../../../core/interfaces/database-engine.interface.js";
import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { execa } from "execa";
import { checkPostgresClient, checkPgDump } from "./postgres-env.js";

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

// Internal Helpers
function buildConnectionArgs(opts: ConnectionOptions): string[] {
  const args: string[] = ["-w"];
  if (opts.host) args.push("-h", opts.host);
  if (opts.port) args.push("-p", opts.port);
  if (opts.user) args.push("-U", opts.user);
  return args;
}

function buildEnv(opts: ConnectionOptions): Record<string, string> {
  const env: Record<string, string> = {
    PAGER: "",
    PSQL_PAGER: "",
  };
  if (opts.password) env["PGPASSWORD"] = opts.password;
  return env;
}

function buildDumpConnectionArgs(opts: ConnectionOptions): string[] {
  const args: string[] = [];
  if (opts.host) args.push("-h", opts.host);
  if (opts.port) args.push("-p", opts.port);
  if (opts.user) args.push("-U", opts.user);
  return args;
}

function generateBackupFilename(
  dbName: string,
  format: "custom" | "plain",
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${dbName}_${date}.${format === "plain" ? "sql" : "dump"}`;
}

const DEFAULT_SCAN_PORTS = [
  "5432",
  "5433",
  "5434",
  "5435",
  "5416",
  "5417",
  "5418",
  "5419",
  "5420",
];

async function detectVersionFromPort(
  host: string,
  port: string,
): Promise<string | null> {
  const result = await runCommand("pg_isready", ["-h", host, "-p", port], {
    timeout: 3000,
  });

  if (result.exitCode === 0) {
    const portNum = parseInt(port);
    if (portNum >= 5410 && portNum <= 5420) {
      const majorVersion = portNum - 5400;
      return `PostgreSQL ${majorVersion} (inferred from port)`;
    }
  }

  return null;
}

export class PostgresEngine implements IDatabaseEngine {
  getHealthChecks(): import("../../../core/interfaces/database-engine.interface.js").HealthCheck[] {
    return [
      {
        name: "psql",
        pendingMessage: "Checking psql...",
        run: async () => {
          const res = await checkBin("psql");
          if (res.ok)
            return {
              status: "success",
              message: `psql is installed: ${res.version}`,
            };
          return {
            status: "error",
            message: `psql is missing. Please install PostgreSQL client tools.`,
          };
        },
      },
      {
        name: "pg_dump",
        pendingMessage: "Checking pg_dump...",
        run: async () => {
          const res = await checkBin("pg_dump");
          if (res.ok)
            return {
              status: "success",
              message: `pg_dump is installed: ${res.version}`,
            };
          return {
            status: "error",
            message: `pg_dump is missing. Backups will not work.`,
          };
        },
      },
      {
        name: "pg_restore",
        pendingMessage: "Checking pg_restore...",
        run: async () => {
          const res = await checkBin("pg_restore");
          if (res.ok)
            return {
              status: "success",
              message: `pg_restore is installed: ${res.version}`,
            };
          return {
            status: "error",
            message: `pg_restore is missing. Custom format restores will not work.`,
          };
        },
      },
      {
        name: "Connection",
        pendingMessage: "Testing database connection...",
        run: async (opts) => {
          try {
            const env: any = { PAGER: "", PSQL_PAGER: "" };
            if (opts.password) env.PGPASSWORD = opts.password;

            const args = [
              "-w",
              "-h",
              opts.host ?? "localhost",
              "-p",
              opts.port ?? "5432",
              "-U",
              opts.user ?? "postgres",
              "-c",
              "SELECT 1;",
              "-q",
              "-t",
              "-A",
            ];
            const result = await execa("psql", args, { env, timeout: 5000 });

            if (result.exitCode === 0) {
              return {
                status: "success",
                message: `Successfully connected to PostgreSQL at ${opts.host ?? "localhost"}:${opts.port ?? "5432"}`,
              };
            }
            return {
              status: "error",
              message: `Connection check returned exit code ${result.exitCode}`,
            };
          } catch (err: any) {
            if (err.message.includes("password authentication failed")) {
              return {
                status: "error",
                message: `Password authentication rejected for user '${opts.user ?? "postgres"}'`,
              };
            }
            return {
              status: "error",
              message: `Could not connect to the database. Make sure PostgreSQL is running and port is open.`,
            };
          }
        },
      },
    ];
  }

  getEngineName(): string {
    return "PostgreSQL";
  }

  async checkClientVersion(): Promise<string> {
    return await checkPostgresClient();
  }

  async checkBackupRequirements(): Promise<void> {
    await checkPgDump();
  }

  async discoverInstances(
    opts: ConnectionOptions = {},
  ): Promise<DatabaseInstance[]> {
    const instances: DatabaseInstance[] = [];
    const host = opts.host ?? "localhost";

    const customPorts = getScanPorts();
    const portsToScan =
      customPorts.length > 0 ? customPorts : DEFAULT_SCAN_PORTS;

    const checks = portsToScan.map(async (port) => {
      const result = await runCommand("pg_isready", ["-h", host, "-p", port], {
        timeout: 3000,
      });

      if (result.exitCode === 0) {
        let serverVersion = await this.getServerVersion({
          ...opts,
          host,
          port,
        });
        if (!serverVersion) {
          serverVersion = await detectVersionFromPort(host, port);
        }
        instances.push({
          port,
          version: serverVersion ?? "running",
          status: "running",
        });
      }
    });

    await Promise.all(checks);
    instances.sort((a, b) => parseInt(a.port) - parseInt(b.port));

    return instances;
  }

  async getServerVersion(opts: ConnectionOptions = {}): Promise<string | null> {
    const args = [
      ...buildConnectionArgs(opts),
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      "SELECT version();",
    ];

    const result = await runCommand("psql", args, {
      env: buildEnv(opts),
      timeout: 5000,
    });

    if (result.exitCode !== 0) {
      return null;
    }

    const output = result.stdout.trim().split(",")[0];
    return output || null;
  }

  async listDatabases(
    opts: ConnectionOptions & { includeSize?: boolean } = {},
  ): Promise<DatabaseInfo[]> {
    let query =
      "SELECT json_agg(json_build_object('name', datname, 'owner', pg_catalog.pg_get_userbyid(datdba), 'encoding', pg_encoding_to_char(encoding))) FROM pg_database WHERE datistemplate = false;";

    if (opts.includeSize) {
      query = `SELECT json_agg(json_build_object('name', datname, 'owner', pg_catalog.pg_get_userbyid(datdba), 'encoding', pg_encoding_to_char(encoding), 'size', pg_size_pretty(size_bytes))) FROM (SELECT datname, datdba, encoding, pg_database_size(datname) as size_bytes FROM pg_database WHERE datistemplate = false ORDER BY size_bytes DESC) as sorted_dbs;`;
    }

    const args = [
      ...buildConnectionArgs(opts),
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      query,
    ];

    const result = await runCommand("psql", args, {
      env: buildEnv(opts),
      timeout: opts.includeSize ? 0 : 60000,
    });

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (errMsg.includes("password") || errMsg.includes("authentication")) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --password <password> list`,
        );
      }
      throw new Error(`Failed to list databases: ${errMsg}`);
    }

    const output = result.stdout.trim();

    if (!output || output === "" || output === "null") {
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
      "-d",
      "postgres",
      "-c",
      `CREATE DATABASE "${name}";`,
    ];

    const result = await runCommand("psql", args, {
      env: buildEnv(opts),
    });

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (errMsg.includes("password") || errMsg.includes("authentication")) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --password <password> create "${name}"`,
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
      "-d",
      "postgres",
      "-c",
      `DROP DATABASE "${name}";`,
    ];

    const result = await runCommand("psql", args, {
      env: buildEnv(opts),
    });

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (errMsg.includes("password") || errMsg.includes("authentication")) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --password <password> drop "${name}"`,
        );
      }
      throw new Error(`Failed to drop database "${name}": ${errMsg}`);
    }
  }

  async backupDatabase(
    dbName: string,
    outputDir: string = "./backups",
    opts: ConnectionOptions = {},
    format: string = "custom",
  ): Promise<string> {
    const resolvedDir = resolve(outputDir);

    if (!existsSync(resolvedDir)) {
      mkdirSync(resolvedDir, { recursive: true });
    }

    const typedFormat = format === "plain" ? "plain" : "custom";
    const filename = generateBackupFilename(dbName, typedFormat);
    const outputPath = join(resolvedDir, filename);

    const formatFlag = typedFormat === "plain" ? "-Fp" : "-Fc";

    const args = [
      ...buildDumpConnectionArgs(opts),
      formatFlag,
      "-f",
      outputPath,
      dbName,
    ];

    const result = await runCommand("pg_dump", args, {
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
    format?: string,
    clean?: boolean,
  ): Promise<void> {
    const resolvedPath = resolve(inputPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Backup file not found: ${resolvedPath}`);
    }

    const isPlainFormat = format
      ? format === "plain"
      : resolvedPath.toLowerCase().endsWith(".sql");

    if (isPlainFormat) {
      const args = [
        ...buildConnectionArgs(opts),
        "-d",
        dbName,
        "-f",
        resolvedPath,
      ];

      const result = await runCommand("psql", args, {
        env: buildEnv(opts),
        timeout: 0,
      });

      if (result.exitCode !== 0) {
        throw new Error(`SQL Restore failed: ${result.stderr}`);
      }
    } else {
      const args = [...buildDumpConnectionArgs(opts), "-d", dbName];

      if (clean) {
        args.push("--clean", "--if-exists");
      }

      args.push(resolvedPath);

      const result = await runCommand("pg_restore", args, {
        env: buildEnv(opts),
        timeout: 0,
      });

      if (result.exitCode === 1) {
        throw new Error(`Restore failed with a fatal error: ${result.stderr}`);
      } else if (result.exitCode > 1) {
        if (result.stderr.toLowerCase().includes("fatal")) {
          throw new Error(`Restore failed: ${result.stderr}`);
        }
      }
    }
  }
}
