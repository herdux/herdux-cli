import { existsSync, readFileSync } from "fs";
import { resolve, extname, basename } from "path";
import { execa } from "execa";

/**
 * Inspects the contents of a database backup file without a live connection.
 *
 * Supported formats:
 *   .dump / .tar   PostgreSQL dump formats — pg_restore --list
 *   .sql           Plain SQL (any engine)  — extracts CREATE statements
 *   .db / .sqlite  SQLite database file    — sqlite3 .schema
 *   .mongodump     MongoDB archive dump    — mongorestore --archive --dryRun
 *
 * @throws if the file does not exist, the extension is unsupported, or the
 *         underlying tool returns a non-zero exit code.
 */
export async function inspectBackupFile(filePath: string): Promise<string> {
  const resolvedPath = resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const ext = extname(resolvedPath).toLowerCase();

  if (ext === ".dump" || ext === ".tar") {
    return inspectPostgresDump(resolvedPath);
  }

  if (ext === ".sql") {
    return inspectSqlFile(resolvedPath);
  }

  if (ext === ".db" || ext === ".sqlite") {
    return inspectSqliteFile(resolvedPath);
  }

  if (ext === ".mongodump") {
    return inspectMongodump(resolvedPath);
  }

  throw new Error(
    `Unsupported file type "${ext}". Supported extensions: .dump / .tar (PostgreSQL), .sql (any engine), .db / .sqlite (SQLite), .mongodump (MongoDB)`,
  );
}

async function inspectPostgresDump(filePath: string): Promise<string> {
  const result = await execa("pg_restore", ["--list", filePath], {
    reject: false,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `pg_restore failed: ${result.stderr || "unknown error"}\n\nMake sure pg_restore is installed and the file is a valid PostgreSQL custom dump.`,
    );
  }

  return result.stdout;
}

function inspectSqlFile(filePath: string): string {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const ddlPatterns = [
    /^CREATE\s+TABLE\b/i,
    /^CREATE\s+(UNIQUE\s+)?INDEX\b/i,
    /^CREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i,
    /^CREATE\s+SEQUENCE\b/i,
    /^CREATE\s+TYPE\b/i,
    /^CREATE\s+FUNCTION\b/i,
    /^CREATE\s+PROCEDURE\b/i,
    /^CREATE\s+TRIGGER\b/i,
  ];

  const statements: string[] = [];
  let currentStatement: string[] = [];
  let inStatement = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inStatement && ddlPatterns.some((p) => p.test(trimmed))) {
      inStatement = true;
      currentStatement = [line];
      // Handle single-line statements (e.g. CREATE INDEX ... ON ...(col);)
      if (trimmed.endsWith(";")) {
        statements.push(currentStatement.join("\n"));
        currentStatement = [];
        inStatement = false;
      }
    } else if (inStatement) {
      currentStatement.push(line);
      if (trimmed.endsWith(";")) {
        statements.push(currentStatement.join("\n"));
        currentStatement = [];
        inStatement = false;
      }
    }
  }

  // Flush any unterminated statement (e.g. no trailing semicolon)
  if (currentStatement.length > 0) {
    statements.push(currentStatement.join("\n"));
  }

  if (statements.length === 0) {
    return "(no CREATE statements found in this SQL file)";
  }

  return statements.join("\n\n");
}

async function inspectSqliteFile(filePath: string): Promise<string> {
  const result = await execa("sqlite3", [filePath, ".schema"], {
    reject: false,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `sqlite3 failed: ${result.stderr || "unknown error"}\n\nMake sure sqlite3 is installed and the file is a valid SQLite database.`,
    );
  }

  const schema = result.stdout.trim();
  return schema || "(empty database — no tables defined)";
}

function inspectMongodump(filePath: string): string {
  // Read raw bytes to verify gzip magic header — no live connection required.
  // mongorestore --dryRun still needs a live MongoDB instance to print collection
  // info, so we inspect the archive offline instead.
  const fileBuffer = readFileSync(filePath) as Buffer;

  // gzip magic: 1f 8b
  if (
    fileBuffer.length < 2 ||
    fileBuffer[0] !== 0x1f ||
    fileBuffer[1] !== 0x8b
  ) {
    throw new Error(
      `Not a valid mongodump archive: ${filePath}\n\nMake sure the file was created with: mongodump --archive=<file> --gzip`,
    );
  }

  const file = basename(filePath);
  const dbName = file
    .replace(/\.mongodump$/, "")
    .replace(/_\d{4}-\d{2}-\d{2}$/, "");

  const bytes = fileBuffer.length;
  const sizeDisplay =
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : bytes >= 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${bytes} B`;

  const lines = [
    `Archive: ${file}`,
    `Size: ${sizeDisplay}`,
    `Format: MongoDB archive (mongodump --archive --gzip)`,
  ];

  if (dbName) lines.push(`Database: ${dbName}`);

  return lines.join("\n");
}
