import { execa } from "execa";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// --- PostgreSQL Integration Test Connection Constants ---

export const PG_HOST = "localhost";
export const PG_PORT = "5499";
export const PG_USER = "herdux_test";
export const PG_PASSWORD = "herdux_test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPOSE_FILE = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "infra",
  "docker",
  "compose.e2e.yml",
);

/**
 * Starts the PostgreSQL test container via docker compose.
 * Waits until the healthcheck passes before returning.
 */
export async function startContainer(): Promise<void> {
  console.log("\nStarting PostgreSQL integration test container...");

  await execa("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "--wait"], {
    stdio: "inherit",
  });

  console.log("Container is ready.\n");
}

/**
 * Stops and removes the PostgreSQL test container and its volumes.
 */
export async function stopContainer(): Promise<void> {
  console.log("\nStopping PostgreSQL integration test container...");

  await execa(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "down", "-v", "--remove-orphans"],
    { stdio: "inherit" },
  );

  console.log("Container removed.\n");
}
