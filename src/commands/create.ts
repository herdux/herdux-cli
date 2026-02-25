import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { checkPostgresClient } from "../infra/engines/postgres/postgres-env.js";
import * as postgres from "../infra/engines/postgres/postgres.engine.js";
import type { ConnectionOptions } from "../infra/engines/postgres/postgres.engine.js";
import { resolveConnectionOptions } from "../infra/engines/postgres/resolve-connection.js";

export function registerCreateCommand(program: Command): void {
  program
    .command("create <name>")
    .description("Create a new database")
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
