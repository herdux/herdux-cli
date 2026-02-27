import { execa } from "execa";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// --- MySQL Integration Test Connection Constants ---

export const MYSQL_HOST = "127.0.0.1";
export const MYSQL_PORT = "3399";
// We use root instead of MYSQL_USER because the Docker-created user
// only has privileges on MYSQL_DATABASE, not global CREATE/DROP.
export const MYSQL_USER = "root";
export const MYSQL_PASSWORD = "herdux_test"; // matches MYSQL_ROOT_PASSWORD

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPOSE_FILE = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "infra",
  "docker",
  "compose.e2e-mysql.yml",
);

/**
 * Starts the MySQL test container via docker compose.
 * Waits until the healthcheck passes before returning.
 */
export async function startContainer(): Promise<void> {
  console.log("\nStarting MySQL integration test container...");

  await execa("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "--wait"], {
    stdio: "inherit",
  });

  console.log("Container is ready.\n");
}

/**
 * Stops and removes the MySQL test container and its volumes.
 */
export async function stopContainer(): Promise<void> {
  console.log("\nStopping MySQL integration test container...");

  await execa(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "down", "-v", "--remove-orphans"],
    { stdio: "inherit" },
  );

  console.log("Container removed.\n");
}
