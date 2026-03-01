import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .alias("ls")
    .description("List all databases on the connected server")
    .addHelpText(
      "after",
      `
Examples:
  hdx list
  hdx ls
  hdx list --size
  hdx list --engine mysql
  hdx list --host 192.168.1.1 --user admin`,
    )
    .option(
      "-S, --size",
      "Calculate and include database sizes (sorted from largest to smallest)",
    )
    .action(async (options: { size?: boolean }) => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        await engine.checkClientVersion();

        const spinner = ora(
          options.size
            ? "Fetching database list and calculating sizes..."
            : "Fetching database list...",
        ).start();

        const databases = await engine.listDatabases({
          ...opts,
          includeSize: options.size,
        });
        spinner.succeed(`Found ${databases.length} database(s)\n`);

        if (databases.length === 0) {
          console.log(chalk.yellow("  No databases found.\n"));
          return;
        }

        const maxDbName = Math.max(
          15,
          "DATABASE".length,
          ...databases.map((db) => db.name.length),
        );
        const nameWidth = maxDbName + 5;
        const ownerWidth = 15;
        const encodingWidth = 12;
        const sizeWidth = options.size ? 15 : 0;

        let header = `  ${"DATABASE".padEnd(nameWidth)}${"OWNER".padEnd(ownerWidth)}${"ENCODING".padEnd(encodingWidth)}`;
        if (options.size) header += "SIZE".padEnd(sizeWidth);

        console.log(chalk.bold(header));
        console.log(
          chalk.gray(
            `  ${"─".repeat(nameWidth + ownerWidth + encodingWidth + sizeWidth - 4)}`,
          ),
        );

        for (const db of databases) {
          const owner = db.owner ?? "";
          const encoding = db.encoding ?? "";
          let row = `  ${chalk.cyan(db.name.padEnd(nameWidth))}${owner.padEnd(ownerWidth)}${encoding.padEnd(encodingWidth)}`;
          if (options.size && db.size) {
            row += chalk.green(db.size.padEnd(sizeWidth));
          }
          console.log(row);
        }

        console.log();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
