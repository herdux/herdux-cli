import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  isDockerAvailable,
  listDatabaseContainers,
  startContainer,
  stopContainer,
} from "../infra/docker/docker.service.js";

async function assertDockerAvailable(): Promise<void> {
  const available = await isDockerAvailable();
  if (!available) {
    console.error(
      chalk.red(
        "\n✖ Docker is not available. Make sure Docker is installed and the daemon is running.\n",
      ),
    );
    process.exit(1);
  }
}

export function registerDockerCommand(program: Command): void {
  const dockerCmd = program
    .command("docker")
    .helpCommand(false)
    .description("Manage database containers (postgres, mysql, mariadb)")
    .addHelpText(
      "after",
      `
Examples:
  hdx docker list
  hdx docker list --all
  hdx docker start pg-dev
  hdx docker stop pg-dev
  hdx docker stop pg-dev --remove`,
    );

  dockerCmd
    .command("list")
    .alias("ls")
    .description("List running database containers")
    .option("-a, --all", "Include stopped containers")
    .action(async (opts: { all?: boolean }) => {
      try {
        await assertDockerAvailable();

        const spinner = ora("Fetching database containers...").start();
        const containers = await listDatabaseContainers(opts.all);

        if (containers.length === 0) {
          spinner.warn(
            opts.all
              ? "No database containers found"
              : "No running database containers found",
          );
          console.log(
            chalk.gray(
              "  Only postgres, mysql, and mariadb images are listed.\n",
            ),
          );
          return;
        }

        const label = opts.all ? "container(s) found" : "running container(s)";
        spinner.succeed(`Found ${containers.length} ${label}\n`);

        const nameWidth =
          Math.max(16, ...containers.map((c) => c.name.length)) + 2;
        const engineWidth = 12;
        const portWidth = 8;

        const header = `  ${"NAME".padEnd(nameWidth)}${"ENGINE".padEnd(engineWidth)}${"PORT".padEnd(portWidth)}STATUS`;
        console.log(chalk.bold(header));
        console.log(
          chalk.gray(
            `  ${"─".repeat(nameWidth + engineWidth + portWidth + 12)}`,
          ),
        );

        for (const c of containers) {
          const portDisplay = c.hostPort
            ? chalk.cyan(c.hostPort.padEnd(portWidth))
            : chalk.gray("─".padEnd(portWidth));
          const isRunning = c.status.toLowerCase().startsWith("up");
          const statusDisplay = isRunning
            ? chalk.green(c.status)
            : chalk.gray(c.status);
          console.log(
            `  ${chalk.cyan(c.name.padEnd(nameWidth))}${c.engineType.padEnd(engineWidth)}${portDisplay}${statusDisplay}`,
          );
        }

        console.log();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });

  dockerCmd
    .command("start <name>")
    .description("Start a stopped database container")
    .action(async (name: string) => {
      try {
        await assertDockerAvailable();
        const spinner = ora(`Starting container "${name}"...`).start();
        await startContainer(name);
        spinner.succeed(`Container "${name}" started\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });

  dockerCmd
    .command("stop <name>")
    .description("Stop a running database container")
    .option("-r, --remove", "Remove the container after stopping")
    .action(async (name: string, opts: { remove?: boolean }) => {
      try {
        await assertDockerAvailable();
        const action = opts.remove
          ? `Stopping and removing container "${name}"...`
          : `Stopping container "${name}"...`;
        const spinner = ora(action).start();
        await stopContainer(name, opts.remove);
        const done = opts.remove
          ? `Container "${name}" stopped and removed\n`
          : `Container "${name}" stopped\n`;
        spinner.succeed(done);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
