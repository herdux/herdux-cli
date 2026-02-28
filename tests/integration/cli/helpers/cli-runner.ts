import { execa, type ResultPromise } from "execa";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = join(__dirname, "../../../../dist/index.js");

export interface CliConfig {
  default?: Record<string, any>;
  servers?: Record<string, any>;
  scan_ports?: string[];
}

export class CliRunner {
  private configDir: string;

  constructor() {
    // Create a unique temporary directory for this runner instance
    this.configDir = mkdtempSync(join(tmpdir(), "herdux-cli-test-"));
  }

  /**
   * Initializes the temporary directory with a specific config.json state.
   */
  public mockConfig(config: CliConfig) {
    const configPath = join(this.configDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Cleans up the temporary configuration directory.
   * Call this in an `afterAll` or `afterEach` hook.
   */
  public cleanup() {
    if (existsSync(this.configDir)) {
      rmSync(this.configDir, { recursive: true, force: true });
    }
  }

  /**
   * Executes the CLI with the provided arguments and the isolated config environment.
   */
  public run(args: string[]): ResultPromise {
    // In order to bypass `process.stdout.isTTY` checks inside the CLI, we either need
    // a real PTY or we pass an environment variable that our code understands for testing.
    // Rather than adding complex PTY libraries, we will use an env variable.
    return execa("node", [CLI_ENTRY, ...args], {
      env: {
        ...process.env,
        HERDUX_CONFIG_DIR: this.configDir,
        FORCE_COLOR: "0",
        HERDUX_TEST_FORCE_TTY: "1", // Custom flag to force TTY in tests
      },
      reject: false,
    });
  }
}
