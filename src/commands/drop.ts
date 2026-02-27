import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function registerDropCommand(program: Command): void {
  program
    .command("drop <name>")
    .description("Drop a database")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (name: string, cmdOpts: { yes?: boolean }) => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        await engine.checkClientVersion();

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

        await engine.dropDatabase(name, opts);
        spinner.succeed(`Database "${name}" dropped successfully\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
