import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveConnectionOptions } from "../infra/engines/postgres/resolve-connection.js";
import { PostgresEngine } from "../infra/engines/postgres/postgres.engine.js";
import type { ConnectionOptions } from "../core/interfaces/database-engine.interface.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check system health and database dependencies")
    .action(async () => {
      console.log(
        chalk.bold("\n--- Herdux Doctor - System Health Check ---\n"),
      );

      const rawOpts = program.opts();
      const opts = await resolveConnectionOptions(
        rawOpts as ConnectionOptions,
        rawOpts.server,
      );

      const engine = new PostgresEngine();
      const checks = engine.getHealthChecks();

      let allOk = true;

      for (const check of checks) {
        const spinner = ora(check.pendingMessage).start();
        try {
          const result = await check.run(opts);
          if (result.status === "success") {
            spinner.succeed(result.message);
          } else if (result.status === "warn") {
            spinner.warn(chalk.yellow(result.message));
          } else {
            spinner.fail(chalk.red(result.message));
            allOk = false;
          }
        } catch (err: any) {
          spinner.fail(chalk.red(`${check.name} failed: ${err.message}`));
          allOk = false;
        }
      }

      console.log();
      if (allOk) {
        console.log(
          chalk.green(
            "✔ Your system is fully equipped to run Herdux commands!",
          ),
        );
      } else {
        console.log(
          chalk.yellow(
            "⚠ Some dependencies are missing. Please fix the warnings above.",
          ),
        );
      }
      console.log();
    });
}
