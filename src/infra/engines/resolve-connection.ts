import ora from "ora";
import chalk from "chalk";
import prompts from "prompts";
import { createEngine } from "./engine-factory.js";
import type {
  ConnectionOptions,
  EngineType,
  IDatabaseEngine,
} from "../../core/interfaces/database-engine.interface.js";
import * as config from "../config/config.service.js";
import { logger } from "../../presentation/logger.js";

// --- Public Types ---

export interface ResolvedConnection {
  engine: IDatabaseEngine;
  engineType: EngineType;
  opts: ConnectionOptions;
}

// --- Main Resolver ---

/**
 * Resolves both the database engine and connection options together.
 *
 * Engine priority:
 *   1. `--engine` CLI flag
 *   2. `engine` field from the selected server profile
 *   3. `engine` field from config defaults (`herdux config set engine mysql`)
 *   4. `"postgres"` fallback
 *
 * Connection priority:
 *   1. Explicit CLI flags (--host, --port, --user, --password)
 *   2. Server profile values
 *   3. Config default values
 *   4. Engine-specific defaults (e.g., port 5432 for PG, 3306 for MySQL)
 */
export async function resolveEngineAndConnection(
  rawOpts: ConnectionOptions & { engine?: EngineType; server?: string },
): Promise<ResolvedConnection> {
  const savedDefaults = config.getDefault();
  let serverName = rawOpts.server;
  let profileEngine: EngineType | undefined;

  // --- Step 1: Resolve server profile (may provide engine) ---

  if (!serverName && !rawOpts.port && !rawOpts.host && process.stdout.isTTY) {
    const servers = config.listServers();
    const serverNames = Object.keys(servers);

    if (serverNames.length > 0) {
      const choices = serverNames.map((name) => {
        const srv = servers[name];
        const engineLabel = srv.engine ? `, engine: ${srv.engine}` : "";
        return {
          title: `${name} (port ${srv.port ?? "?"}${engineLabel})`,
          value: name,
        };
      });

      if (Object.keys(savedDefaults).length > 0) {
        const defaultEngineLabel = savedDefaults.engine
          ? `, engine: ${savedDefaults.engine}`
          : "";
        choices.unshift({
          title: `Default connection (port ${savedDefaults.port ?? "?"}${defaultEngineLabel})`,
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

  // --- Step 2: Determine engine type ---

  // Priority: CLI flag > profile engine > config default engine > "postgres"
  let engineType: EngineType;

  if (rawOpts.engine) {
    engineType = rawOpts.engine;
  } else if (serverName) {
    const profile = config.getServer(serverName);
    profileEngine = profile?.engine;
    engineType = profileEngine ?? savedDefaults.engine ?? "postgres";
  } else {
    engineType = savedDefaults.engine ?? "postgres";
  }

  const engine = createEngine(engineType);

  // --- Step 3: Resolve connection options ---

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

    const defaults = engine.getDefaultConnectionOptions();
    return {
      engine,
      engineType,
      opts: {
        host: rawOpts.host ?? serverProfile.host ?? defaults.host,
        port: rawOpts.port ?? serverProfile.port,
        user: rawOpts.user ?? serverProfile.user ?? defaults.user,
        password: rawOpts.password ?? serverProfile.password,
      },
    };
  }

  // No server profile — merge CLI opts with config defaults
  const merged: ConnectionOptions = {
    host: rawOpts.host ?? savedDefaults.host,
    port: rawOpts.port ?? savedDefaults.port,
    user: rawOpts.user ?? savedDefaults.user,
    password: rawOpts.password ?? savedDefaults.password,
  };

  if (merged.port) {
    return { engine, engineType, opts: merged };
  }

  // --- Step 4: Auto-discovery ---

  const spinner = ora(
    `Scanning for running ${engine.getEngineName()} servers...`,
  ).start();
  const instances = await engine.discoverInstances(merged);

  if (instances.length === 0) {
    spinner.fail(`No running ${engine.getEngineName()} servers found`);
    logger.blank();
    logger.error(
      `Could not find any ${engine.getEngineName()} server on common ports.`,
    );
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
    return { engine, engineType, opts: { ...merged, port: instance.port } };
  }

  spinner.succeed(`Found ${instances.length} running servers`);

  const choices = instances.map((inst) => ({
    title: `Port ${inst.port} — ${inst.version}`,
    value: inst.port,
  }));

  const response = await prompts({
    type: "select",
    name: "port",
    message: `Multiple ${engine.getEngineName()} servers found. Which one do you want to use?`,
    choices,
  });

  if (!response.port) {
    console.log(chalk.yellow("\n⚠ Operation cancelled.\n"));
    process.exit(0);
  }

  return { engine, engineType, opts: { ...merged, port: response.port } };
}
