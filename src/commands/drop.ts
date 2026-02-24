import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { checkPostgresClient } from "../services/environment.service.js";
import * as postgres from "../services/postgres.service.js";
import type { ConnectionOptions } from "../services/postgres.service.js";
import { resolveConnectionOptions } from "../utils/resolve-connection.js";

export function registerDropCommand(program: Command): void {
  program
    .command("drop <name>")
    .description("Drop a database")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (name: string, cmdOpts: { yes?: boolean }) => {
      try {
        await checkPostgresClient();

        const rawOpts = program.opts();
        const opts = await resolveConnectionOptions(
          rawOpts as ConnectionOptions,
          rawOpts.server,
        );

        if (!cmdOpts.yes) {
          const response = await prompts({
            type: "confirm",
            name: "confirm",
            message: `Are you sure you want to drop database "${name}"? This action is irreversible.`,
            initial: false,
          });

          if (!response.confirm) {
            console.log(chalk.yellow("\n⚠ Operation cancelled.\n"));
            return;
          }
        }

        const spinner = ora(`Dropping database "${name}"...`).start();

        await postgres.dropDatabase(name, opts);
        spinner.succeed(`Database "${name}" dropped successfully\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
