/**
 * Centralized engine configurations for parametrized unit tests.
 *
 * Add a new entry here when a new engine is supported.
 * All command test suites pick this up automatically via describe.each(engines).
 */
export type EngineConfig = {
  engineType: "postgres" | "mysql";
  engineName: string;
  defaultOpts: { host: string; port: string; user: string };
  clientVersionStr: string;
};

export const engines: EngineConfig[] = [
  {
    engineType: "postgres",
    engineName: "PostgreSQL",
    defaultOpts: { host: "localhost", port: "5432", user: "postgres" },
    clientVersionStr: "psql (PostgreSQL) 15.0",
  },
  {
    engineType: "mysql",
    engineName: "MySQL",
    defaultOpts: { host: "localhost", port: "3306", user: "root" },
    clientVersionStr: "mysql  Ver 8.0.33 Distrib 8.0.33, for Linux (x86_64)",
  },
];
