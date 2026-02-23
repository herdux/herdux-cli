import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  checkPostgresClient,
  checkPgDump,
} from "../services/environment.service.js";
import * as backup from "../services/backup.service.js";
import * as postgres from "../services/postgres.service.js";
import type { ConnectionOptions } from "../services/postgres.service.js";
import { resolveConnectionOptions } from "../utils/resolve-connection.js";

export function registerBackupCommand(program: Command): void {
  program
    .command("backup <database>")
    .description("Create a backup of a PostgreSQL database")
    .option(
      "-o, --output <dir>",
      "Output directory for the backup",
      "./backups",
    )
    .option("-d, --drop", "Ask to drop the database after a successful backup")
    .option("-y, --yes", "Skip confirmation when dropping (requires --drop)")
    .option(
      "-F, --format <type>",
      "Backup format format (custom, plain)",
      "custom",
    )
    .action(
      async (
        database: string,
        cmdOpts: {
          output: string;
          drop?: boolean;
          yes?: boolean;
          format: string;
        },
      ) => {
        try {
          await checkPostgresClient();
          await checkPgDump();

          const rawOpts = program.opts();
          const opts = await resolveConnectionOptions(
            rawOpts as ConnectionOptions,
            rawOpts.server,
          );

          if (cmdOpts.format !== "custom" && cmdOpts.format !== "plain") {
            console.error(
              chalk.red(
                `\n✖ Invalid format "${cmdOpts.format}". Use "custom" or "plain".\n`,
              ),
            );
            process.exit(1);
          }

          const spinner = ora(`Generating backup for "${database}"...`).start();

          const outputPath = await backup.backupDatabase(
            database,
            cmdOpts.output,
            opts,
            cmdOpts.format as "custom" | "plain",
          );
          spinner.succeed(`Backup saved at ${chalk.cyan(outputPath)}\n`);

          if (cmdOpts.drop) {
            let shouldDrop = cmdOpts.yes;

            if (!shouldDrop) {
              const response = await prompts({
                type: "confirm",
                name: "confirmDrop",
                message: `Are you sure you want to drop the database "${database}"?`,
                initial: false,
              });
              shouldDrop = response.confirmDrop;
            }

            if (shouldDrop) {
              const dropSpinner = ora(
                `Dropping database "${database}"...`,
              ).start();
              await postgres.dropDatabase(database, opts);
              dropSpinner.succeed(
                `Database "${database}" dropped successfully\n`,
              );
            } else {
              console.log(
                chalk.gray(`  Skipped dropping database "${database}".\n`),
              );
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✖ ${message}\n`));
          process.exit(1);
        }
      },
    );
}
