import ora from "ora";
import { logger } from "../core/logger.js";
import { binaryExists, getBinaryVersion } from "../utils/detect-binary.js";

export async function checkPostgresClient(): Promise<string> {
  const spinner = ora("Checking PostgreSQL client...").start();

  const exists = await binaryExists("psql");

  if (!exists) {
    spinner.fail("PostgreSQL client (psql) not found");
    logger.blank();
    logger.error("psql is not available in your PATH.");
    logger.blank();
    logger.info("To fix this, you can:");
    logger.line("1. Install PostgreSQL client:");
    logger.line("   • Windows: choco install postgresql");
    logger.line("   • macOS:   brew install libpq");
    logger.line("   • Ubuntu:  sudo apt install postgresql-client");
    logger.blank();
    logger.line("2. Or use Docker:");
    logger.line("   docker run --rm -it postgres:16 psql --version");
    logger.blank();
    process.exit(1);
  }

  const version = await getBinaryVersion("psql");
  spinner.succeed(`  Found ${version ?? "psql"}`);

  return version ?? "unknown";
}

export async function checkPgDump(): Promise<string> {
  const spinner = ora("Checking pg_dump...").start();

  const exists = await binaryExists("pg_dump");

  if (!exists) {
    spinner.fail("pg_dump not found");
    logger.error("pg_dump is required for backup operations.");
    logger.info(
      "It is usually included with the PostgreSQL client installation.",
    );
    process.exit(1);
  }

  const version = await getBinaryVersion("pg_dump");
  spinner.succeed(`  Found ${version ?? "pg_dump"}`);

  return version ?? "unknown";
}

export async function checkDocker(): Promise<boolean> {
  const exists = await binaryExists("docker");

  if (exists) {
    const version = await getBinaryVersion("docker");
    logger.success(`Docker detected: ${version ?? "docker"}`);
  } else {
    logger.warn("Docker not detected (optional)");
  }

  return exists;
}
