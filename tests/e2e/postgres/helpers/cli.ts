import { execa } from "execa";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD } from "./docker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..", "..");
const ENTRY_POINT = resolve(PROJECT_ROOT, "src", "index.ts");

export interface CliResult {
  stdout: string;
  stderr: string;
  /** Combined stdout + stderr — useful since ora spinners write to stderr */
  output: string;
  exitCode: number;
}

/**
 * Runs the herdux CLI as a child process against the integration PostgreSQL container.
 * Uses `tsx` to execute TypeScript directly — no build step needed.
 *
 * @example
 *   const result = await runCli("create", "my_test_db");
 *   const result = await runCli("backup", "my_test_db", "--drop", "--yes");
 *   const result = await runCli("list");
 */
export async function runCli(...args: string[]): Promise<CliResult> {
  const connectionArgs = [
    "--host", PG_HOST,
    "--port", PG_PORT,
    "--user", PG_USER,
    "--password", PG_PASSWORD,
  ];

  const result = await execa(
    "npx",
    ["tsx", ENTRY_POINT, ...connectionArgs, ...args],
    {
      cwd: PROJECT_ROOT,
      reject: false,
      env: {
        ...process.env,
        // Non-interactive mode — no TTY prompts
        NODE_ENV: "test",
        // Isolated HOME to avoid polluting the real ~/.herdux/config.json
        HOME: resolve(PROJECT_ROOT, "tests", "e2e", "postgres", ".tmp-home"),
      },
      timeout: 30_000,
    },
  );

  const stdout = result.stdout?.toString() ?? "";
  const stderr = result.stderr?.toString() ?? "";

  return {
    stdout,
    stderr,
    output: `${stdout}\n${stderr}`.trim(),
    exitCode: result.exitCode ?? (result.failed ? 1 : 0),
  };
}
