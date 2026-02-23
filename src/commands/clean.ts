import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  checkPostgresClient,
  checkPgDump,
} from "../services/environment.service.js";
import * as postgres from "../services/postgres.service.js";
import * as backup from "../services/backup.service.js";
import type { ConnectionOptions } from "../services/postgres.service.js";
import { resolveConnectionOptions } from "../utils/resolve-connection.js";

export function registerCleanCommand(program: Command): void {
  program
    .command("clean")
    .description("Interactive bulk cleanup tool to drop multiple databases")
    .action(async () => {
      try {
        await checkPostgresClient();

        const rawOpts = program.opts();
        const opts = await resolveConnectionOptions(
          rawOpts as ConnectionOptions,
          rawOpts.server,
        );

        let spinner = ora("Fetching databases...").start();
        const databases = await postgres.listDatabases(opts);
        spinner.stop();

        if (databases.length === 0) {
          console.log(chalk.yellow("  No databases found to clean.\n"));
          return;
        }

        const response = await prompts({
          type: "multiselect",
          name: "selectedDbs",
          message:
            "Select databases to DROP (Space to select, Enter to confirm):",
          choices: databases.map((db) => ({
            title: `${db.name} (owner: ${db.owner})`,
            value: db.name,
          })),
          min: 1,
          hint: "- Space to select. Return to submit",
        });

        const selectedDbs: string[] = response.selectedDbs;

        if (!selectedDbs || selectedDbs.length === 0) {
          console.log(chalk.yellow("\n⚠ Clean operation cancelled.\n"));
          return;
        }

        console.log(
          chalk.red(
            `\nYou selected ${selectedDbs.length} database(s) for deletion.`,
          ),
        );

        const backupResponse = await prompts({
          type: "confirm",
          name: "backupFirst",
          message:
            "Would you like to backup these databases before dropping them?",
          initial: true,
        });

        if (backupResponse.backupFirst) {
          await checkPgDump();
          console.log(chalk.cyan("\n📦 Starting backups..."));
          for (const db of selectedDbs) {
            spinner = ora(`Backing up "${db}"...`).start();
            try {
              const outObj = await backup.backupDatabase(
                db,
                "./backups",
                opts,
                "custom",
              );
              spinner.succeed(`Saved to ${outObj}`);
            } catch (err) {
              spinner.fail(`Failed to backup ${db}`);
              const message = err instanceof Error ? err.message : String(err);
              console.error(chalk.red(`  ↳ ${message}`));
              console.log(
                chalk.yellow(
                  "\n⚠ Aborting clean process to prevent data loss without backup.",
                ),
              );
              process.exit(1);
            }
          }
        }

        const confirmDelete = await prompts({
          type: "confirm",
          name: "confirm",
          message: chalk.red(
            `Are you absolutely sure you want to DROP ${selectedDbs.length} database(s)? This action is irreversible.`,
          ),
          initial: false,
        });

        if (!confirmDelete.confirm) {
          console.log(chalk.yellow("\n⚠ Clean operation aborted.\n"));
          return;
        }

        console.log();
        for (const db of selectedDbs) {
          spinner = ora(`Dropping "${db}"...`).start();
          try {
            await postgres.dropDatabase(db, opts);
            spinner.succeed(`Dropped "${db}"`);
          } catch (err) {
            spinner.fail(`Failed to drop "${db}"`);
            const message = err instanceof Error ? err.message : String(err);
            console.error(chalk.red(`  ↳ ${message}`));
          }
        }

        console.log(chalk.green(`\n✔ Clean operation completed!`));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
