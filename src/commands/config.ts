import type { Command } from "commander";
import chalk from "chalk";
import * as config from "../infra/config/config.service.js";
import { logger } from "../presentation/logger.js";

const VALID_KEYS = ["host", "port", "user", "password", "output", "engine"];

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .helpCommand(false)
    .description(
      "Manage Herdux configuration (default connection, server profiles, scan ports)",
    )
    .addHelpText(
      "after",
      `
Examples:
  hdx config list
  hdx config set host 192.168.1.1
  hdx config set engine mysql
  hdx config get host
  hdx config add-server prod --host prod.example.com --user admin
  hdx config scan-ports 5432 5433`,
    );

  configCmd;
  configCmd
    .command("set <key> <value>")
    .description(
      "Set a default config value (engine, host, port, user, password, output)",
    )
    .action((key: string, value: string) => {
      if (!VALID_KEYS.includes(key)) {
        logger.error(
          `Invalid key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`,
        );
        process.exit(1);
      }

      config.setDefault(key, value);
      const displayValue = key === "password" ? "••••••" : value;
      logger.success(
        `Default ${chalk.cyan(key)} set to ${chalk.green(displayValue)}`,
      );
      logger.line(`Saved to ${chalk.gray(config.getConfigPath())}`);
    });

  configCmd;
  configCmd
    .command("get <key>")
    .description("Get a config value")
    .action((key: string) => {
      const defaults = config.getDefault();
      const value = (defaults as Record<string, string>)[key];

      if (value === undefined) {
        logger.warn(`No value set for "${key}"`);
      } else {
        const displayValue = key === "password" ? "••••••" : value;
        console.log(`${chalk.cyan(key)}: ${displayValue}`);
      }
    });

  configCmd;
  configCmd
    .command("list")
    .alias("ls")
    .description("Show all saved configuration")
    .action(() => {
      const cfg = config.loadConfig();

      logger.title("Herdux Configuration");

      const defaults = cfg.default;
      const hasDefaults = Object.keys(defaults).length > 0;

      if (hasDefaults) {
        console.log(chalk.bold("Default Connection:"));
        for (const [key, value] of Object.entries(defaults)) {
          const displayValue = key === "password" ? "••••••" : value;
          console.log(`    ${chalk.cyan(key)}: ${displayValue}`);
        }
      } else {
        console.log(chalk.gray("  No default connection configured."));
      }

      console.log();

      const servers = cfg.servers;
      const serverNames = Object.keys(servers);

      if (serverNames.length > 0) {
        console.log(chalk.bold("  Server Profiles:"));
        for (const name of serverNames) {
          const srv = servers[name];
          const engineLabel = srv.engine
            ? `engine=${chalk.yellow(srv.engine)}`
            : "";
          const parts = [
            engineLabel,
            srv.host && `host=${srv.host}`,
            srv.port && `port=${chalk.cyan(srv.port)}`,
            srv.user && `user=${srv.user}`,
            srv.password && `password=••••••`,
          ].filter(Boolean);
          console.log(`    ${chalk.green(name)}: ${parts.join(", ")}`);
        }
      } else {
        console.log(chalk.gray("  No server profiles configured."));
      }

      if (cfg.scan_ports.length > 0) {
        console.log();
        console.log(chalk.bold("  Custom Scan Ports:"));
        console.log(`    ${cfg.scan_ports.join(", ")}`);
      }

      console.log();
      console.log(chalk.gray(`  Config file: ${config.getConfigPath()}`));
      console.log();
    });

  configCmd;
  configCmd
    .command("reset")
    .description("Reset all configuration")
    .action(() => {
      config.resetConfig();
      logger.success("Configuration reset successfully");
    });

  configCmd;
  configCmd
    .command("add-server <name>")
    .alias("add")
    .description(
      "Add a named server profile (uses global --engine, --host, --port, --user, --password)",
    )
    .action((name: string) => {
      const globalOpts = program.opts();
      const serverOpts = {
        ...(globalOpts.engine && { engine: globalOpts.engine }),
        ...(globalOpts.host && { host: globalOpts.host }),
        ...(globalOpts.port && { port: globalOpts.port }),
        ...(globalOpts.user && { user: globalOpts.user }),
        ...(globalOpts.password && { password: globalOpts.password }),
      };

      if (Object.keys(serverOpts).length === 0) {
        logger.error(
          "Provide at least one option (--engine, --host, --port, --user, --password)",
        );
        process.exit(1);
      }

      config.addServer(name, serverOpts);
      logger.success(`Server profile "${chalk.green(name)}" saved`);

      const parts = [
        serverOpts.engine && `engine=${serverOpts.engine}`,
        serverOpts.host && `host=${serverOpts.host}`,
        serverOpts.port && `port=${serverOpts.port}`,
        serverOpts.user && `user=${serverOpts.user}`,
        serverOpts.password && `password=••••••`,
      ].filter(Boolean);
      logger.line(parts.join(", "));
    });

  configCmd;
  configCmd
    .command("remove-server <name>")
    .alias("rm")
    .description("Remove a named server profile")
    .action((name: string) => {
      const removed = config.removeServer(name);

      if (removed) {
        logger.success(`Server profile "${name}" removed`);
      } else {
        logger.warn(`Server profile "${name}" not found`);
      }
    });

  configCmd;
  configCmd
    .command("scan-ports <ports...>")
    .alias("scan")
    .description(
      "Set custom ports used when auto-discovering running database instances",
    )
    .addHelpText(
      "after",
      `
Examples:
  hdx config scan-ports 5432
  hdx config scan-ports 5432 5433
  hdx config scan-ports 3306 3307

Note: These ports are used when no explicit --port flag is provided and Herdux needs
      to auto-detect a running server (e.g. on 'hdx version' or 'hdx list').
      Use 'hdx config list' to see the currently configured scan ports.`,
    )
    .action((ports: string[]) => {
      config.setScanPorts(ports);
      logger.success(`Scan ports set to: ${chalk.cyan(ports.join(", "))}`);
    });
}
