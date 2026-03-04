import { execa } from "execa";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// --- MongoDB Integration Test Connection Constants ---

export const MONGODB_HOST = "127.0.0.1";
export const MONGODB_PORT = "27099";

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPOSE_FILE = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "infra",
  "docker",
  "compose.e2e-mongodb.yml",
);

/**
 * Starts the MongoDB test container via docker compose.
 * Waits until the healthcheck passes before returning.
 */
export async function startContainer(): Promise<void> {
  console.log("\nStarting MongoDB integration test container...");

  await execa("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "--wait"], {
    stdio: "inherit",
  });

  console.log("Container is ready.\n");
}

/**
 * Stops and removes the MongoDB test container and its volumes.
 */
export async function stopContainer(): Promise<void> {
  console.log("\nStopping MongoDB integration test container...");

  await execa(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "down", "-v", "--remove-orphans"],
    { stdio: "inherit" },
  );

  console.log("Container removed.\n");
}
