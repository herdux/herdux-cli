import type { Command } from "commander";
import chalk from "chalk";
import { inspectBackupFile } from "../infra/engines/inspect-backup.js";

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect <file>")
    .description(
      "Inspect the contents of a backup file without connecting to a database",
    )
    .addHelpText(
      "after",
      `
Supported formats:
  .dump          PostgreSQL custom format  Output: full Table of Contents (pg_restore --list)
  .sql           Plain SQL (any engine)    Output: CREATE TABLE / VIEW / INDEX / SEQUENCE statements
  .db / .sqlite  SQLite database file      Output: database schema (sqlite3 .schema)

Examples:
  hdx inspect backup.dump
  hdx inspect export.sql
  hdx inspect mydb.db`,
    )
    .action(async (file: string) => {
      try {
        const output = await inspectBackupFile(file);
        console.log(output);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
