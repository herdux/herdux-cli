import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore <file>")
    .description(
      "Restore a database from a backup file (auto-creates the database if it does not exist)",
    )
    .addHelpText(
      "after",
      `
Examples:
  hdx restore backup.dump --db mydb
  hdx restore backup.sql --db mydb --format plain
  hdx restore backup.dump --db mydb --engine mysql
  hdx restore backup.dump --db mydb --host 192.168.1.1 --user admin

Note: If the target database does not exist it will be created automatically.
      Restoration warnings (e.g. missing roles) are reported but do not stop the process.`,
    )
    .requiredOption("--db <name>", "Target database name for restore")
    .option("-F, --format <type>", "Override auto-detection (custom, plain)")
    .action(async (file: string, cmdOpts: { db: string; format?: string }) => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        await engine.checkClientVersion();

        if (
          cmdOpts.format &&
          cmdOpts.format !== "custom" &&
          cmdOpts.format !== "plain"
        ) {
          console.error(
            chalk.red(
              `\n✖ Invalid format "${cmdOpts.format}". Use "custom" or "plain".\n`,
            ),
          );
          process.exit(1);
        }

        const spinner = ora(
          `Restoring "${file}" into database "${cmdOpts.db}"...`,
        ).start();

        let didCreateDb = false;
        try {
          spinner.text = `Ensuring database "${cmdOpts.db}" exists...`;
          await engine.createDatabase(cmdOpts.db, opts);
          didCreateDb = true;
        } catch (err: any) {
          // Ignore error if database already exists
          if (
            !err.message.includes("already exists") &&
            !String(err).includes("already exists")
          ) {
            spinner.fail(`Failed to verify or create database "${cmdOpts.db}"`);
            throw err;
          }
        }

        spinner.text = `Restoring data into "${cmdOpts.db}"...`;

        const result = await engine.restoreDatabase(
          file,
          cmdOpts.db,
          opts,
          cmdOpts.format as "custom" | "plain" | undefined,
        );

        let successMsg = `Database "${cmdOpts.db}" restored successfully from ${chalk.cyan(file)}`;
        if (didCreateDb) {
          successMsg += chalk.dim(
            `\n  ↳ Note: Database did not exist and was automatically created.`,
          );
        }

        if (result && result.hasWarnings) {
          spinner.warn(
            successMsg +
              chalk.yellow(
                `\n\n⚠ Restore completed with warnings\n  - Some roles or ACLs were skipped (common when restoring production dumps locally)\n  - Database is usable and operational\n`,
              ),
          );
          return;
        }

        spinner.succeed(successMsg + "\n");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
