import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { checkPostgresClient } from "../services/environment.service.js";
import * as backup from "../services/backup.service.js";
import type { ConnectionOptions } from "../services/postgres.service.js";
import { resolveConnectionOptions } from "../utils/resolve-connection.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore <file>")
    .description("Restore a PostgreSQL database from a backup file")
    .requiredOption("--db <name>", "Target database name for restore")
    .option("-F, --format <type>", "Override auto-detection (custom, plain)")
    .action(async (file: string, cmdOpts: { db: string; format?: string }) => {
      try {
        await checkPostgresClient();

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

        await backup.restoreDatabase(
          file,
          cmdOpts.db,
          opts,
          cmdOpts.format as "custom" | "plain" | undefined,
        );
        spinner.succeed(
          `Database "${cmdOpts.db}" restored successfully from ${chalk.cyan(file)}\n`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
