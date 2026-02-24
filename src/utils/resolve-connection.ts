import ora from "ora";
import chalk from "chalk";
import prompts from "prompts";
import { discoverInstances } from "../services/postgres.service.js";
import type { ConnectionOptions } from "../services/postgres.service.js";
import * as config from "../services/config.service.js";
import { logger } from "../core/logger.js";

export async function resolveConnectionOptions(
  opts: ConnectionOptions,
  serverName?: string,
): Promise<ConnectionOptions> {
  const savedDefaults = config.getDefault();

  if (!serverName && !opts.port && !opts.host && process.stdout.isTTY) {
    const servers = config.listServers();
    const serverNames = Object.keys(servers);

    if (serverNames.length > 0) {
      const choices = serverNames.map((name) => ({
        title: `${name} (port ${servers[name].port ?? "?"})`,
        value: name,
      }));

      if (Object.keys(savedDefaults).length > 0) {
        choices.unshift({
          title: `Default connection (port ${savedDefaults.port ?? "?"})`,
          value: "__default__",
        });
      }

      const response = await prompts({
        type: "select",
        name: "server",
        message: "Select a connection to use:",
        choices,
      });

      if (!response.server) {
        console.log(chalk.yellow("\n⚠ Operation cancelled.\n"));
        process.exit(0);
      }

      if (response.server !== "__default__") {
        serverName = response.server;
      }
    }
  }

  if (serverName) {
    const serverProfile = config.getServer(serverName);
    if (!serverProfile) {
      logger.error(`Server profile "${serverName}" not found.`);
      logger.info("Available profiles:");
      const servers = config.listServers();
      const names = Object.keys(servers);
      if (names.length === 0) {
        logger.line("(none)");
        logger.line(
          "Add one with: herdux config add-server <name> --port <port> --password <pw>",
        );
      } else {
        for (const name of names) {
          logger.line(
            `  ${chalk.green(name)}: port=${servers[name].port ?? "?"}`,
          );
        }
      }
      process.exit(1);
    }

    return {
      host: opts.host ?? serverProfile.host ?? "localhost",
      port: opts.port ?? serverProfile.port,
      user: opts.user ?? serverProfile.user ?? "postgres",
      password: opts.password ?? serverProfile.password,
    };
  }

  const merged: ConnectionOptions = {
    host: opts.host ?? savedDefaults.host,
    port: opts.port ?? savedDefaults.port,
    user: opts.user ?? savedDefaults.user,
    password: opts.password ?? savedDefaults.password,
  };

  if (merged.port) {
    return merged;
  }

  const spinner = ora("Scanning for running PostgreSQL servers...").start();
  const instances = await discoverInstances(merged);

  if (instances.length === 0) {
    spinner.fail("No running PostgreSQL servers found");
    logger.blank();
    logger.error("Could not find any PostgreSQL server on common ports.");
    logger.info("Options:");
    logger.line("1. Specify port: herdux --port 5417 list");
    logger.line("2. Save defaults: herdux config set port 5417");
    logger.line("3. Add server:    herdux config add-server pg17 --port 5417");
    logger.blank();
    process.exit(1);
  }

  if (instances.length === 1) {
    const instance = instances[0];
    spinner.succeed(
      `Auto-detected server on port ${chalk.cyan(instance.port)} (${instance.version})`,
    );
    return { ...merged, port: instance.port };
  }

  spinner.succeed(`  Found ${instances.length} running servers`);

  const choices = instances.map((inst) => ({
    title: `Port ${inst.port} — ${inst.version}`,
    value: inst.port,
  }));

  const response = await prompts({
    type: "select",
    name: "port",
    message: "Multiple PostgreSQL servers found. Which one do you want to use?",
    choices,
  });

  if (!response.port) {
    console.log(chalk.yellow("\n⚠ Operation cancelled.\n"));
    process.exit(0);
  }

  return { ...merged, port: response.port };
}
