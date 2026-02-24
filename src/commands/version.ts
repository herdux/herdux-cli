import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { checkPostgresClient } from "../services/environment.service.js";
import * as postgres from "../services/postgres.service.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Show PostgreSQL client and server versions")
    .action(async () => {
      try {
        await checkPostgresClient();

        const clientVersion = await postgres.getVersion();
        console.log(chalk.bold.cyan("\n🐘 PostgreSQL Client"));
        console.log(`   ${clientVersion}`);

        const opts = program.opts();
        const spinner = ora(
          "Scanning for running PostgreSQL servers...",
        ).start();
        const instances = await postgres.discoverInstances(opts);

        if (instances.length === 0) {
          spinner.warn("No running PostgreSQL servers found");
          console.log(chalk.yellow("   No servers detected on common ports."));
          console.log(chalk.gray("   Use --port to specify a custom port.\n"));
        } else {
          spinner.succeed(`Found ${instances.length} running server(s)\n`);

          console.log(chalk.bold.cyan("🖥️  Running Servers"));
          for (const instance of instances) {
            const portBadge = chalk.bgGreen.black(` :${instance.port} `);
            console.log(`   ${portBadge} ${instance.version}`);
          }
          console.log();
        }

        console.log(chalk.bold.cyan("📦 herdux CLI"));
        console.log(`   v${program.version()}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
