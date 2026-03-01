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
import type { ServerProfile } from "../config/config.service.js";
import { logger } from "../../presentation/logger.js";

// --- Public Types ---

export interface ResolvedConnection {
  engine: IDatabaseEngine;
  engineType: EngineType;
  opts: ConnectionOptions;
}

// --- Private Helpers ---

type SavedDefaults = ConnectionOptions & {
  output?: string;
  engine?: EngineType;
};

/**
 * Presents an interactive prompt for the user to select a server profile.
 * Returns the selected server name, or undefined if the user selected
 * the default connection or no options were available.
 */
async function promptServerSelection(
  servers: Record<string, ServerProfile>,
  serverNames: string[],
  savedDefaults: SavedDefaults,
  requestedEngine?: EngineType,
): Promise<string | undefined> {
  const dEngine = savedDefaults.engine ?? "postgres";
  const isDefaultCompatible = !requestedEngine || dEngine === requestedEngine;
  const hasDefaults = Object.keys(savedDefaults).length > 0;

  if (serverNames.length === 0 && !(hasDefaults && isDefaultCompatible)) {
    return undefined;
  }

  const choices = serverNames.map((name) => {
    const srv = servers[name];
    const engineLabel = srv.engine ? `, engine: ${srv.engine}` : "";
    return {
      title: `${name} (port ${srv.port ?? "?"}${engineLabel})`,
      value: name,
    };
  });

  if (hasDefaults && isDefaultCompatible) {
    const defaultEngineLabel = `, engine: ${dEngine}`;
    choices.unshift({
      title: `Default connection (port ${savedDefaults.port ?? "?"}${defaultEngineLabel})`,
      value: "__default__",
    });
  }

  if (choices.length === 0) {
    return undefined;
  }

  if (choices.length === 1) {
    const choice = choices[0];
    console.log(chalk.green(`✔ Auto-selected connection: › ${choice.title}`));
    return choice.value !== "__default__" ? choice.value : undefined;
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

  return response.server !== "__default__" ? response.server : undefined;
}

/**
 * Determines the engine type from the CLI flag, server profile, or config defaults.
 * Priority: CLI flag > server profile engine > config default engine > "postgres"
 */
function resolveEngineType(
  rawEngine: EngineType | undefined,
  serverName: string | undefined,
  savedDefaults: SavedDefaults,
): EngineType {
  if (rawEngine) return rawEngine;
  if (serverName) {
    const profile = config.getServer(serverName);
    return profile?.engine ?? savedDefaults.engine ?? "postgres";
  }
  return savedDefaults.engine ?? "postgres";
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

  // --- Step 1: Resolve server profile (may provide engine) ---

  const isInteractive =
    process.stdout.isTTY || process.env.HERDUX_TEST_FORCE_TTY === "1";

  if (!serverName && !rawOpts.port && !rawOpts.host && isInteractive) {
    const servers = config.listServers();
    let serverNames = Object.keys(servers);

    if (rawOpts.engine) {
      serverNames = serverNames.filter(
        (name) => servers[name].engine === rawOpts.engine,
      );
    }

    const selected = await promptServerSelection(
      servers,
      serverNames,
      savedDefaults,
      rawOpts.engine,
    );

    if (selected !== undefined) {
      serverName = selected;
    }
  }

  // --- Step 2: Determine engine type ---

  const engineType = resolveEngineType(
    rawOpts.engine,
    serverName,
    savedDefaults,
  );
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
