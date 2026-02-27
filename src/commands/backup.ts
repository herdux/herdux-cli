import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";
import * as config from "../infra/config/config.service.js";
import { join } from "path";
import { homedir } from "os";

export function registerBackupCommand(program: Command): void {
  program
    .command("backup <database>")
    .description("Create a backup of a database")
    .option(
      "-o, --output <dir>",
      "Output directory for the backup (overrides global config)",
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
          output?: string;
          drop?: boolean;
          yes?: boolean;
          format: string;
        },
      ) => {
        try {
          const rawOpts = program.opts();
          const { engine, opts } = await resolveEngineAndConnection(rawOpts);
          await engine.checkClientVersion();
          await engine.checkBackupRequirements();

          if (cmdOpts.format !== "custom" && cmdOpts.format !== "plain") {
            console.error(
              chalk.red(
                `\n✖ Invalid format "${cmdOpts.format}". Use "custom" or "plain".\n`,
              ),
            );
            process.exit(1);
          }

          const configDefaults = config.getDefault();

          let finalOutputDir = cmdOpts.output;
          if (!finalOutputDir) {
            finalOutputDir =
              configDefaults.output || join(homedir(), ".herdux", "backups");
          }

          const spinner = ora(`Generating backup for "${database}"...`).start();

          const outputPath = await engine.backupDatabase(
            database,
            finalOutputDir,
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
              await engine.dropDatabase(database, opts);
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
