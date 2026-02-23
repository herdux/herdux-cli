import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { checkPostgresClient } from "../services/environment.service.js";
import * as postgres from "../services/postgres.service.js";
import type { ConnectionOptions } from "../services/postgres.service.js";
import { resolveConnectionOptions } from "../utils/resolve-connection.js";

export function registerCreateCommand(program: Command): void {
  program
    .command("create <name>")
    .description("Create a new PostgreSQL database")
    .action(async (name: string) => {
      try {
        await checkPostgresClient();

        const rawOpts = program.opts();
        const opts = await resolveConnectionOptions(
          rawOpts as ConnectionOptions,
          rawOpts.server,
        );

        const spinner = ora(`Creating database "${name}"...`).start();

        await postgres.createDatabase(name, opts);
        spinner.succeed(`Database "${name}" created successfully\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
