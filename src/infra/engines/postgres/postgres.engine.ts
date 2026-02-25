import { runCommand } from "../../command-runner.js";
import { getScanPorts } from "../../config/config.service.js";

export interface ConnectionOptions {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
}

// -w prevents psql from hanging on a password prompt
function buildConnectionArgs(opts: ConnectionOptions): string[] {
  const args: string[] = ["-w"];

  if (opts.host) {
    args.push("-h", opts.host);
  }
  if (opts.port) {
    args.push("-p", opts.port);
  }
  if (opts.user) {
    args.push("-U", opts.user);
  }

  return args;
}

// Disable pager to prevent 'cat' not found errors on Windows
function buildEnv(opts: ConnectionOptions): Record<string, string> {
  const env: Record<string, string> = {
    PAGER: "",
    PSQL_PAGER: "",
  };

  if (opts.password) {
    env["PGPASSWORD"] = opts.password;
  }

  return env;
}

export async function getVersion(): Promise<string> {
  const result = await runCommand("psql", ["--version"]);

  if (result.exitCode !== 0) {
    throw new Error("Failed to get PostgreSQL version");
  }

  return result.stdout.trim();
}

export interface PostgresInstance {
  port: string;
  version: string;
  status: "running" | "unreachable";
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

export async function discoverInstances(
  opts: ConnectionOptions = {},
): Promise<PostgresInstance[]> {
  const instances: PostgresInstance[] = [];
  const host = opts.host ?? "localhost";

  const customPorts = getScanPorts();
  const portsToScan = customPorts.length > 0 ? customPorts : DEFAULT_SCAN_PORTS;

  const checks = portsToScan.map(async (port) => {
    const result = await runCommand("pg_isready", ["-h", host, "-p", port], {
      timeout: 3000,
    });

    if (result.exitCode === 0) {
      // Try getting exact version via SQL, fallback to port inference
      let serverVersion = await getServerVersion({ ...opts, host, port });
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

export async function getServerVersion(
  opts: ConnectionOptions = {},
): Promise<string | null> {
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

// Common convention: PG 16 runs on 5416, PG 17 on 5417, etc.
async function detectVersionFromPort(
  host: string,
  port: string,
): Promise<string | null> {
  const result = await runCommand("pg_isready", ["-h", host, "-p", port], {
    timeout: 3000,
  });

  if (result.exitCode === 0 && result.stdout) {
  }

  const portNum = parseInt(port);
  if (portNum >= 5410 && portNum <= 5420) {
    const majorVersion = portNum - 5400;
    return `PostgreSQL ${majorVersion} (inferred from port)`;
  }

  return null;
}

export interface DatabaseInfo {
  name: string;
  owner: string;
  encoding: string;
  size?: string;
}

export interface ListDatabasesOptions extends ConnectionOptions {
  includeSize?: boolean;
}

export async function listDatabases(
  opts: ListDatabasesOptions = {},
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

export async function createDatabase(
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

export async function dropDatabase(
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
