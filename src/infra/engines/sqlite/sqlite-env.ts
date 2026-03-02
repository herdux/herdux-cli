import ora from "ora";
import { logger } from "../../../presentation/logger.js";
import { binaryExists, getBinaryVersion } from "../../utils/detect-binary.js";

export async function checkSqliteClient(): Promise<string> {
  const spinner = ora("Checking SQLite client...").start();

  const exists = await binaryExists("sqlite3");

  if (!exists) {
    spinner.fail("SQLite client (sqlite3) not found");
    logger.blank();
    logger.error("sqlite3 is not available in your PATH.");
    logger.blank();
    logger.info("To fix this, you can:");
    logger.line("1. Install SQLite:");
    logger.line("   • Windows: choco install sqlite");
    logger.line("   • macOS:   brew install sqlite");
    logger.line("   • Ubuntu:  sudo apt install sqlite3");
    logger.blank();
    process.exit(1);
  }

  const version = await getBinaryVersion("sqlite3");
  spinner.succeed(`Found ${version ?? "sqlite3"}`);

  return version ?? "unknown";
}
