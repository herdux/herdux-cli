import { filterSqlDirectives } from "../../../src/infra/engines/sql-filter.js";

describe("filterSqlDirectives()", () => {
  // --- PostgreSQL directives ---

  it("removes \\connect meta-commands", () => {
    const input =
      "SET lock_timeout = 0;\n\\connect sateus\nCREATE TABLE t (id int);";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("\\connect");
    expect(result).toContain("SET lock_timeout = 0;");
    expect(result).toContain("CREATE TABLE t");
  });

  it("removes \\c shorthand meta-commands", () => {
    const input = "\\c sateus\nSELECT 1;";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("\\c sateus");
    expect(result).toContain("SELECT 1;");
  });

  it("removes single-line CREATE DATABASE statement", () => {
    const input = "CREATE DATABASE sateus;\nCREATE TABLE t (id int);";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("CREATE DATABASE");
    expect(result).toContain("CREATE TABLE t");
  });

  it("removes multi-line CREATE DATABASE block", () => {
    const input = [
      "CREATE DATABASE sateus",
      "    WITH TEMPLATE = template0",
      "    ENCODING = 'UTF8';",
      "CREATE TABLE t (id int);",
    ].join("\n");
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("CREATE DATABASE");
    expect(result).not.toContain("WITH TEMPLATE");
    expect(result).toContain("CREATE TABLE t");
  });

  it("removes DROP DATABASE statement", () => {
    const input = "DROP DATABASE IF EXISTS sateus;\nCREATE TABLE t (id int);";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("DROP DATABASE");
    expect(result).toContain("CREATE TABLE t");
  });

  // --- MySQL directives ---

  it("removes USE statement", () => {
    const input = "USE `sateus`;\nCREATE TABLE t (id int);";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("USE `sateus`");
    expect(result).toContain("CREATE TABLE t");
  });

  it("removes USE statement without backticks", () => {
    const input = "USE sateus;\nINSERT INTO t VALUES (1);";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("USE sateus");
    expect(result).toContain("INSERT INTO t");
  });

  // --- Case insensitivity ---

  it("is case-insensitive for directives", () => {
    const input = "create database foo;\nuse bar;\n\\Connect baz\nSELECT 1;";
    const result = filterSqlDirectives(input);
    expect(result).not.toContain("create database");
    expect(result).not.toContain("use bar");
    expect(result).not.toContain("\\Connect");
    expect(result).toContain("SELECT 1;");
  });

  // --- Passthrough ---

  it("does not alter SQL that has no redirect directives", () => {
    const input =
      "CREATE TABLE users (id serial, name text);\nINSERT INTO users VALUES (1, 'Alice');";
    expect(filterSqlDirectives(input)).toBe(input);
  });

  it("preserves CREATE TABLE that starts with CREATE keyword", () => {
    const input = "CREATE TABLE database_config (key text, val text);";
    const result = filterSqlDirectives(input);
    expect(result).toContain("CREATE TABLE database_config");
  });
});
