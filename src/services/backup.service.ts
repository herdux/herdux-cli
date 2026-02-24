import { runCommand } from "../core/command-runner.js";
import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import type { ConnectionOptions } from "./postgres.service.js";

function generateBackupFilename(
  dbName: string,
  format: "custom" | "plain",
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${dbName}_${date}.${format === "plain" ? "sql" : "dump"}`;
}

function buildConnectionArgs(opts: ConnectionOptions): string[] {
  const args: string[] = [];

  if (opts.host) args.push("-h", opts.host);
  if (opts.port) args.push("-p", opts.port);
  if (opts.user) args.push("-U", opts.user);

  return args;
}

function buildEnv(opts: ConnectionOptions): Record<string, string> {
  const env: Record<string, string> = {};
  if (opts.password) env["PGPASSWORD"] = opts.password;
  return env;
}

export async function backupDatabase(
  dbName: string,
  outputDir: string = "./backups",
  opts: ConnectionOptions = {},
  format: "custom" | "plain" = "custom",
): Promise<string> {
  const resolvedDir = resolve(outputDir);

  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true });
  }

  const filename = generateBackupFilename(dbName, format);
  const outputPath = join(resolvedDir, filename);

  const formatFlag = format === "plain" ? "-Fp" : "-Fc";

  const args = [
    ...buildConnectionArgs(opts),
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

export async function restoreDatabase(
  inputPath: string,
  dbName: string,
  opts: ConnectionOptions = {},
  format?: "custom" | "plain",
): Promise<void> {
  const resolvedPath = resolve(inputPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Backup file not found: ${resolvedPath}`);
  }

  // Explicit format overrides extension-based detection. Default: .sql = plain, everything else = custom.
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
    const args = [
      ...buildConnectionArgs(opts),
      "-d",
      dbName,
      "--clean",
      "--if-exists",
      resolvedPath,
    ];

    const result = await runCommand("pg_restore", args, {
      env: buildEnv(opts),
      timeout: 0,
    });

    // Exit code 1 = Fatal Error. Exit code 2 = Non-fatal warnings (e.g. role does not exist)
    if (result.exitCode === 1) {
      throw new Error(`Restore failed with a fatal error: ${result.stderr}`);
    } else if (result.exitCode > 1) {
      // In PostgreSQL 15+, exit code 2 is warning.
      // We don't throw, but it's good to let the user know if there was serious stderr.
      if (result.stderr.toLowerCase().includes("fatal")) {
        throw new Error(`Restore failed: ${result.stderr}`);
      }
    }
  }
}
