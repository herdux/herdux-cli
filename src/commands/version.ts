import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Show Database client and server versions")
    .action(async () => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        const clientVersion = await engine.checkClientVersion();
        console.log(
          chalk.bold.cyan(`\n--- ${engine.getEngineName()} Client ---`),
        );
        console.log(`   ${clientVersion}`);

        const spinner = ora(
          `Scanning for running ${engine.getEngineName()} servers...`,
        ).start();
        const instances = await engine.discoverInstances(opts);

        if (instances.length === 0) {
          spinner.warn(`No running ${engine.getEngineName()} servers found`);
          console.log(chalk.yellow("   No servers detected on common ports."));
          console.log(chalk.gray("   Use --port to specify a custom port.\n"));
        } else {
          spinner.succeed(`Found ${instances.length} running server(s)\n`);

          console.log(chalk.bold.cyan("--- Running Servers ---"));
          for (const instance of instances) {
            const portBadge = chalk.bgGreen.black(` :${instance.port} `);
            console.log(`   ${portBadge} ${instance.version}`);
          }
          console.log();
        }

        console.log(chalk.bold.cyan("--- Herdux CLI ---"));
        console.log(`   v${program.version()}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
