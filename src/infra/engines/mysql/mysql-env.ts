import { binaryExists, getBinaryVersion } from "../../utils/detect-binary.js";

/**
 * Checks that the `mysql` client binary is available and returns its version string.
 * Throws a user-friendly error if not found.
 */
export async function checkMysqlClient(): Promise<string> {
  const found = await binaryExists("mysql");
  if (!found) {
    throw new Error(
      "MySQL client (mysql) not found.\n" +
        "Please install the MySQL client tools to continue.\n" +
        "  Ubuntu/Debian: sudo apt install mysql-client\n" +
        "  macOS:         brew install mysql-client",
    );
  }
  const version = await getBinaryVersion("mysql");
  return version ?? "mysql (version unknown)";
}

/**
 * Checks that `mysqldump` is available.
 * Throws a user-friendly error if not found.
 */
export async function checkMysqlDump(): Promise<void> {
  const found = await binaryExists("mysqldump");
  if (!found) {
    throw new Error(
      "mysqldump not found.\n" +
        "Please install the MySQL client tools to enable backup and restore.\n" +
        "  Ubuntu/Debian: sudo apt install mysql-client\n" +
        "  macOS:         brew install mysql-client",
    );
  }
}
