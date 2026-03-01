import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function registerCreateCommand(program: Command): void {
  program
    .command("create <name>")
    .description("Create a new empty database")
    .addHelpText(
      "after",
      `
Examples:
  hdx create mydb
  hdx create mydb --engine mysql
  hdx create mydb --host 192.168.1.1 --user admin`,
    )
    .action(async (name: string) => {
      if (/[\s;|&`$<>(){}\\]/.test(name)) {
        console.error(
          chalk.red(
            `\n✖ Invalid database name "${name}". Avoid spaces and special characters (; | & \` $ < > ( ) { } \\).\n`,
          ),
        );
        process.exit(1);
      }

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
