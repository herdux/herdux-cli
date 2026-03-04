import { runCommand } from "../../command-runner.js";
import type {
  IDatabaseEngine,
  ConnectionOptions,
  DatabaseInstance,
  DatabaseInfo,
  HealthCheck,
} from "../../../core/interfaces/database-engine.interface.js";
import { existsSync, mkdirSync } from "fs";
import { join, resolve, basename } from "path";
import { execa } from "execa";
import { checkMongoshClient, checkMongodump } from "./mongodb-env.js";

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

function buildMongoshURI(opts: ConnectionOptions, db: string): string {
  const host = opts.host ?? "localhost";
  const port = opts.port ?? "27017";
  if (opts.user && opts.password) {
    return `mongodb://${encodeURIComponent(opts.user)}:${encodeURIComponent(opts.password)}@${host}:${port}/${db}?authSource=admin`;
  }
  return `mongodb://${host}:${port}/${db}`;
}

function buildDumpAuthArgs(opts: ConnectionOptions): string[] {
  const args: string[] = [];
  if (opts.user && opts.password) {
    args.push(
      "--username",
      opts.user,
      "--password",
      opts.password,
      "--authenticationDatabase",
      "admin",
    );
  }
  return args;
}

function generateBackupFilename(dbName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${dbName}_${date}.mongodump`;
}

const DEFAULT_SCAN_PORTS = ["27017", "27018", "27019"];

const SYSTEM_DBS = new Set(["admin", "config", "local"]);

// --- MongodbEngine ---

export class MongodbEngine implements IDatabaseEngine {
  getHealthChecks(): HealthCheck[] {
    return [
      {
        name: "mongosh",
        pendingMessage: "Checking mongosh client...",
        run: async () => {
          const res = await checkBin("mongosh");
          if (res.ok)
            return {
              status: "success",
              message: `mongosh is installed: ${res.version}`,
            };
          return {
            status: "error",
            message:
              "mongosh is missing. Install it: apt install mongodb-mongosh / brew install mongosh",
          };
        },
      },
      {
        name: "mongodump",
        pendingMessage: "Checking mongodump...",
        run: async () => {
          const res = await checkBin("mongodump");
          if (res.ok)
            return {
              status: "success",
              message: `mongodump is installed: ${res.version}`,
            };
          return {
            status: "error",
            message:
              "mongodump is missing. Backups will not work. Install: apt install mongodb-database-tools",
          };
        },
      },
      {
        name: "Connection",
        pendingMessage: "Testing database connection...",
        run: async (opts) => {
          try {
            const host = opts.host ?? "localhost";
            const port = opts.port ?? "27017";
            const uri = buildMongoshURI({ ...opts, host, port }, "admin");
            const result = await execa(
              "mongosh",
              [uri, "--quiet", "--eval", "db.version()"],
              { timeout: 5000 },
            );
            if (result.exitCode === 0) {
              return {
                status: "success",
                message: `Successfully connected to MongoDB at ${host}:${port}`,
              };
            }
            return {
              status: "error",
              message: `Connection check returned exit code ${result.exitCode}`,
            };
          } catch (err: any) {
            if (
              err.message?.includes("Authentication") ||
              err.message?.includes("authentication") ||
              err.message?.includes("Unauthorized")
            ) {
              return {
                status: "error",
                message: `Authentication failed. Check your username and password.`,
              };
            }
            return {
              status: "error",
              message:
                "Could not connect to the database. Make sure MongoDB is running and port is open.",
            };
          }
        },
      },
    ];
  }

  getEngineName(): string {
    return "MongoDB";
  }

  getDefaultConnectionOptions(): ConnectionOptions {
    return { host: "localhost", port: "27017" };
  }

  async checkClientVersion(): Promise<string> {
    return await checkMongoshClient();
  }

  async checkBackupRequirements(): Promise<void> {
    await checkMongodump();
  }

  async discoverInstances(
    opts: ConnectionOptions = {},
  ): Promise<DatabaseInstance[]> {
    const instances: DatabaseInstance[] = [];
    const host = opts.host ?? "localhost";

    const checks = DEFAULT_SCAN_PORTS.map(async (port) => {
      try {
        const uri = buildMongoshURI({ ...opts, host, port }, "admin");
        const result = await execa(
          "mongosh",
          [uri, "--quiet", "--eval", "db.version()"],
          { timeout: 3000 },
        );
        if (result.exitCode === 0) {
          const version = result.stdout.trim() || "running";
          instances.push({
            port,
            version: `MongoDB ${version}`,
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
    const host = opts.host ?? "localhost";
    const port = opts.port ?? "27017";
    const uri = buildMongoshURI({ ...opts, host, port }, "admin");

    const result = await runCommand(
      "mongosh",
      [uri, "--quiet", "--eval", "db.version()"],
      { timeout: 5000 },
    );

    if (result.exitCode !== 0) return null;

    const output = result.stdout.trim();
    return output ? `MongoDB ${output}` : null;
  }

  async listDatabases(
    opts: ConnectionOptions & { includeSize?: boolean } = {},
  ): Promise<DatabaseInfo[]> {
    const host = opts.host ?? "localhost";
    const port = opts.port ?? "27017";
    const uri = buildMongoshURI({ ...opts, host, port }, "admin");

    const evalExpr = opts.includeSize
      ? `JSON.stringify(db.adminCommand({listDatabases:1}).databases.map(d=>({name:d.name,size:Math.round(d.sizeOnDisk/1024)+' kB'})))`
      : `JSON.stringify(db.adminCommand({listDatabases:1}).databases.map(d=>({name:d.name})))`;

    const result = await runCommand(
      "mongosh",
      [uri, "--quiet", "--eval", evalExpr],
      {
        timeout: 60000,
      },
    );

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (
        errMsg.includes("Authentication") ||
        errMsg.includes("authentication") ||
        errMsg.includes("Unauthorized")
      ) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --engine mongodb --password <password> list`,
        );
      }
      throw new Error(`Failed to list databases: ${errMsg}`);
    }

    const output = result.stdout.trim();
    if (!output || output === "null" || output === "[]") return [];

    try {
      const dbs = JSON.parse(output) as Array<{ name: string; size?: string }>;
      return dbs
        .filter((db) => !SYSTEM_DBS.has(db.name))
        .map((db) => ({ name: db.name, size: db.size }));
    } catch {
      throw new Error(`Failed to parse database list: ${output}`);
    }
  }

  async createDatabase(
    name: string,
    opts: ConnectionOptions = {},
  ): Promise<void> {
    const existing = await this.listDatabases(opts);
    if (existing.some((db) => db.name === name)) {
      throw new Error(`Database "${name}" already exists.`);
    }

    const host = opts.host ?? "localhost";
    const port = opts.port ?? "27017";
    const uri = buildMongoshURI({ ...opts, host, port }, name);

    const result = await runCommand(
      "mongosh",
      [
        uri,
        "--quiet",
        "--eval",
        "db.createCollection('_herdux_init'); db.getCollection('_herdux_init').drop()",
      ],
      { timeout: 10000 },
    );

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (
        errMsg.includes("Authentication") ||
        errMsg.includes("authentication") ||
        errMsg.includes("Unauthorized")
      ) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --engine mongodb --password <password> create "${name}"`,
        );
      }
      throw new Error(`Failed to create database "${name}": ${errMsg}`);
    }
  }

  async dropDatabase(
    name: string,
    opts: ConnectionOptions = {},
  ): Promise<void> {
    const host = opts.host ?? "localhost";
    const port = opts.port ?? "27017";
    const uri = buildMongoshURI({ ...opts, host, port }, name);

    const result = await runCommand(
      "mongosh",
      [uri, "--quiet", "--eval", "db.dropDatabase()"],
      { timeout: 30000 },
    );

    if (result.exitCode !== 0) {
      const errMsg = result.stderr;
      if (
        errMsg.includes("Authentication") ||
        errMsg.includes("authentication") ||
        errMsg.includes("Unauthorized")
      ) {
        throw new Error(
          `Authentication failed. Use --password to provide credentials:\n  herdux --engine mongodb --password <password> drop "${name}"`,
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
    if (format && format !== "custom") {
      throw new Error(
        `MongoDB does not support "${format}" format. Only archive format is available.\n  Remove --format or use: --format custom`,
      );
    }

    const resolvedDir = resolve(outputDir);
    if (!existsSync(resolvedDir)) {
      mkdirSync(resolvedDir, { recursive: true });
    }

    const filename = generateBackupFilename(dbName);
    const outputPath = join(resolvedDir, filename);

    const host = opts.host ?? "localhost";
    const port = opts.port ?? "27017";

    const args = [
      `--host=${host}`,
      `--port=${port}`,
      `--db=${dbName}`,
      `--archive=${outputPath}`,
      "--gzip",
      ...buildDumpAuthArgs(opts),
    ];

    const result = await runCommand("mongodump", args, { timeout: 0 });

    if (result.exitCode !== 0) {
      throw new Error(`Backup failed for "${dbName}": ${result.stderr}`);
    }

    return outputPath;
  }

  async restoreDatabase(
    filePath: string,
    dbName: string,
    opts: ConnectionOptions = {},
    _format?: string,
    _clean?: boolean,
  ): Promise<{ hasWarnings: boolean; warnings?: string } | void> {
    const resolvedPath = resolve(filePath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Backup file not found: ${resolvedPath}`);
    }

    const host = opts.host ?? "localhost";
    const port = opts.port ?? "27017";

    // Extract original DB name from filename (e.g., "mydb_2026-03-01.mongodump" → "mydb")
    const sourceName = basename(resolvedPath)
      .replace(/\.mongodump$/, "")
      .replace(/_\d{4}-\d{2}-\d{2}$/, "");

    const args = [
      `--host=${host}`,
      `--port=${port}`,
      `--archive=${resolvedPath}`,
      "--gzip",
      ...buildDumpAuthArgs(opts),
    ];

    // Remap namespaces if target name differs from source name
    if (sourceName && sourceName !== dbName) {
      args.push(`--nsFrom=${sourceName}.*`, `--nsTo=${dbName}.*`);
    }

    const result = await runCommand("mongorestore", args, { timeout: 0 });

    if (result.exitCode !== 0) {
      throw new Error(`Restore failed: ${result.stderr}`);
    }
  }
}
