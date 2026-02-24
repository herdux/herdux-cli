import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { execa } from "execa";
import { resolveConnectionOptions } from "../utils/resolve-connection.js";
import type { ConnectionOptions } from "../services/postgres.service.js";

async function checkBin(
  binName: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const result = await execa(binName, ["--version"], { timeout: 5000 });
    return { ok: true, version: result.stdout.trim().split("\n")[0] };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check system health and PostgreSQL dependencies")
    .action(async () => {
      console.log(chalk.bold("\n🩺 herdux Doctor - System Health Check\n"));

      const rawOpts = program.opts();
      const opts = await resolveConnectionOptions(
        rawOpts as ConnectionOptions,
        rawOpts.server,
      );

      let spinner = ora("Checking psql...").start();
      const psqlCheck = await checkBin("psql");
      if (psqlCheck.ok) {
        spinner.succeed(`psql is installed: ${chalk.cyan(psqlCheck.version)}`);
      } else {
        spinner.fail(
          `psql is missing. Please install PostgreSQL client tools.`,
        );
      }

      spinner = ora("Checking pg_dump...").start();
      const dumpCheck = await checkBin("pg_dump");
      if (dumpCheck.ok) {
        spinner.succeed(
          `pg_dump is installed: ${chalk.cyan(dumpCheck.version)}`,
        );
      } else {
        spinner.fail(`pg_dump is missing. Backups will not work.`);
      }

      spinner = ora("Checking pg_restore...").start();
      const restoreCheck = await checkBin("pg_restore");
      if (restoreCheck.ok) {
        spinner.succeed(
          `pg_restore is installed: ${chalk.cyan(restoreCheck.version)}`,
        );
      } else {
        spinner.fail(
          `pg_restore is missing. Custom format restores will not work.`,
        );
      }

      spinner = ora(
        `Testing connection to ${opts.host}:${opts.port} as '${opts.user}'...`,
      ).start();
      try {
        const env: any = { PAGER: "", PSQL_PAGER: "" };
        if (opts.password) env.PGPASSWORD = opts.password;

        const args = [
          "-w",
          "-h",
          opts.host ?? "localhost",
          "-p",
          opts.port ?? "5432",
          "-U",
          opts.user ?? "postgres",
          "-c",
          "SELECT 1;",
          "-q",
          "-t",
          "-A",
        ];
        const result = await execa("psql", args, { env, timeout: 5000 });

        if (result.exitCode === 0) {
          spinner.succeed(
            `Successfully connected to PostgreSQL at ${chalk.cyan(`${opts.host}:${opts.port}`)}`,
          );
        } else {
          spinner.fail(
            `Connection check returned exit code ${result.exitCode}`,
          );
        }
      } catch (err: any) {
        if (err.message.includes("password authentication failed")) {
          spinner.fail(
            `Connection failed: Password authentication rejected for user '${opts.user}'`,
          );
        } else {
          spinner.fail(
            `Connection failed: Could not connect to the database. Make sure PostgreSQL is running and port is open.`,
          );
          console.error(chalk.gray(`  ↳ ${err.shortMessage || err.message}`));
        }
      }

      console.log();
      if (psqlCheck.ok && dumpCheck.ok && restoreCheck.ok) {
        console.log(
          chalk.green(
            "✔ Your system is fully equipped to run herdux commands!",
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
