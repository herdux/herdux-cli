import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function registerCreateCommand(program: Command): void {
  program
    .command("create <name>")
    .description("Create a new database")
    .action(async (name: string) => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        await engine.checkClientVersion();

        const spinner = ora(`Creating database "${name}"...`).start();

        await engine.createDatabase(name, opts);
        spinner.succeed(`Database "${name}" created successfully\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
