/**
 * Strips database-redirect directives from a plain SQL file before restore.
 *
 * Some dump tools (pg_dump -C, pgAdmin, mysqldump --databases) embed statements
 * that redirect the connection to the source database, overriding the --db target
 * specified by the user. This function removes those directives so the restore
 * always targets the correct database.
 *
 * Stripped patterns:
 *   PostgreSQL: \connect <db> / \c <db>  — psql meta-commands
 *   MySQL:      USE <db>;                — MySQL USE statement
 *   Both:       CREATE DATABASE ...;     — database creation block
 *               DROP DATABASE ...;       — database drop block
 */
export function filterSqlDirectives(content: string): string {
  const lines: string[] = [];
  let insideBlock = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // PostgreSQL: \connect and \c meta-commands redirect psql to another DB
    if (/^\\(connect|c)\b/i.test(trimmed)) continue;

    // MySQL: USE statement redirects mysql client to another DB
    if (/^USE\s+/i.test(trimmed)) continue;

    // CREATE DATABASE / DROP DATABASE may span multiple lines (WITH clause, etc.)
    if (/^(CREATE|DROP)\s+DATABASE\b/i.test(trimmed)) {
      insideBlock = true;
    }

    if (insideBlock) {
      if (trimmed.endsWith(";")) insideBlock = false;
      continue;
    }

    lines.push(line);
  }

  return lines.join("\n");
}
