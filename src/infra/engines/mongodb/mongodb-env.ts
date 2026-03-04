import { binaryExists, getBinaryVersion } from "../../utils/detect-binary.js";

/**
 * Checks that the `mongosh` client binary is available and returns its version string.
 * Throws a user-friendly error if not found.
 */
export async function checkMongoshClient(): Promise<string> {
  const found = await binaryExists("mongosh");
  if (!found) {
    throw new Error(
      "MongoDB Shell (mongosh) not found.\n" +
        "Please install mongosh to continue.\n" +
        "  Ubuntu/Debian: sudo apt install mongodb-mongosh\n" +
        "  macOS:         brew install mongosh\n" +
        "  Docs:          https://www.mongodb.com/docs/mongodb-shell/install/",
    );
  }
  const version = await getBinaryVersion("mongosh");
  return version ?? "mongosh (version unknown)";
}

/**
 * Checks that `mongodump` and `mongorestore` are available.
 * Throws a user-friendly error if not found.
 */
export async function checkMongodump(): Promise<void> {
  const found = await binaryExists("mongodump");
  if (!found) {
    throw new Error(
      "mongodump not found.\n" +
        "Please install the MongoDB Database Tools to enable backup and restore.\n" +
        "  Ubuntu/Debian: sudo apt install mongodb-database-tools\n" +
        "  macOS:         brew install mongodb-database-tools\n" +
        "  Docs:          https://www.mongodb.com/docs/database-tools/",
    );
  }
}
