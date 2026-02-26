import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { PostgresEngine } from "../infra/engines/postgres/postgres.engine.js";
import type { ConnectionOptions } from "../core/interfaces/database-engine.interface.js";
import { resolveConnectionOptions } from "../infra/engines/postgres/resolve-connection.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore <file>")
    .description(
      "Restore a database from a backup file (auto-creates DB if missing)",
    )
    .requiredOption("--db <name>", "Target database name for restore")
    .option("-F, --format <type>", "Override auto-detection (custom, plain)")
    .action(async (file: string, cmdOpts: { db: string; format?: string }) => {
      try {
        const engine = new PostgresEngine();
        await engine.checkClientVersion();

        const rawOpts = program.opts();
        const opts = await resolveConnectionOptions(
          rawOpts as ConnectionOptions,
          rawOpts.server,
        );

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

        await engine.restoreDatabase(
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

        spinner.succeed(successMsg + "\n");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
