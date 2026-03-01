import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";
import * as config from "../infra/config/config.service.js";
import { join } from "path";
import { homedir } from "os";

export function registerCleanCommand(program: Command): void {
  program
    .command("clean")
    .description("Interactively select and drop multiple databases at once")
    .addHelpText(
      "after",
      `
Examples:
  hdx clean
  hdx clean --engine mysql
  hdx clean --host 192.168.1.1 --user admin

Note: You will be prompted to select databases, optionally backup them first,
      and confirm before any data is deleted.`,
    )
    .action(async () => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        await engine.checkClientVersion();

        let spinner = ora("Fetching databases...").start();
        const databases = await engine.listDatabases(opts);
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
          await engine.checkBackupRequirements();

          const configDefaults = config.getDefault();
          const backupDir =
            configDefaults.output || join(homedir(), ".herdux", "backups");

          console.log(chalk.cyan("\nStarting backups..."));
          for (const db of selectedDbs) {
            spinner = ora(`Backing up "${db}"...`).start();
            try {
              const outObj = await engine.backupDatabase(
                db,
                backupDir,
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
            await engine.dropDatabase(db, opts);
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
