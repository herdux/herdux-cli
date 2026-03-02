import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";
import { logger } from "../presentation/logger.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description(
      "Show the database client version and detect running server instances",
    )
    .addHelpText(
      "after",
      `
Examples:
  hdx version
  hdx version --engine mysql
  hdx version --host 192.168.1.1`,
    )
    .action(async () => {
      try {
        const rawOpts = program.opts();
        const { engine, opts } = await resolveEngineAndConnection(rawOpts);
        const clientVersion = await engine.checkClientVersion();

        logger.title(`${engine.getEngineName()} Client`);
        logger.line(clientVersion);
        logger.blank();

        const isPortless = !engine.getDefaultConnectionOptions().port;

        if (isPortless) {
          logger.info(
            `${engine.getEngineName()} is file-based. No server instances to scan.`,
          );
          logger.blank();
        } else {
          const spinner = ora(
            `Scanning for running ${engine.getEngineName()} servers...`,
          ).start();
          const instances = await engine.discoverInstances(opts);

          if (instances.length === 0) {
            spinner.warn(`No running ${engine.getEngineName()} servers found`);
            console.log(
              chalk.yellow("   No servers detected on common ports."),
            );
            console.log(
              chalk.gray("   Use --port to specify a custom port.\n"),
            );
          } else {
            spinner.succeed(`Found ${instances.length} running server(s)\n`);

            logger.title("Running Servers");
            for (const instance of instances) {
              const portBadge = chalk.bgGreen.black(` :${instance.port} `);
              logger.line(`${portBadge} ${instance.version}`);
            }
            logger.blank();
          }
        }

        logger.title("Herdux CLI");
        logger.line(`v${program.version()}`);
        logger.blank();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
