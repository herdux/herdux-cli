import { execa } from "execa";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

// Isolated SQLite directory for E2E tests — avoids polluting the real ~/.herdux/sqlite
export const SQLITE_DIR = resolve(
  PROJECT_ROOT,
  "tests",
  "e2e",
  "sqlite",
  ".tmp-sqlite",
);
export const TMP_HOME = resolve(
  PROJECT_ROOT,
  "tests",
  "e2e",
  "sqlite",
  ".tmp-home",
);

/**
 * Runs the herdux CLI as a child process against the SQLite E2E test directory.
 * Uses `tsx` to execute TypeScript directly — no build step needed.
 *
 * The `--host` flag is repurposed as the SQLite database directory.
 *
 * @example
 *   const result = await runCli("create", "my_test_db");
 *   const result = await runCli("list");
 */
export async function runCli(...args: string[]): Promise<CliResult> {
  const result = await execa(
    "npx",
    ["tsx", ENTRY_POINT, "--engine", "sqlite", "--host", SQLITE_DIR, ...args],
    {
      cwd: PROJECT_ROOT,
      reject: false,
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOME: TMP_HOME,
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
