import { jest } from "@jest/globals";

// We test the real engine-factory — no mocks needed for the factory itself.
// We only need to verify it returns the correct engine type.

const { createEngine } =
  await import("../../../src/infra/engines/engine-factory.js");

describe("createEngine", () => {
  it('returns a PostgresEngine when called with "postgres"', () => {
    const engine = createEngine("postgres");
    expect(engine.getEngineName()).toBe("PostgreSQL");
  });

  it('returns a MysqlEngine when called with "mysql"', () => {
    const engine = createEngine("mysql");
    expect(engine.getEngineName()).toBe("MySQL");
  });

  it("returns PostgresEngine as default when called without arguments", () => {
    const engine = createEngine();
    expect(engine.getEngineName()).toBe("PostgreSQL");
  });

  it("returns PostgresEngine as default when called with undefined", () => {
    const engine = createEngine(undefined);
    expect(engine.getEngineName()).toBe("PostgreSQL");
  });

  it("returns correct default connection options for each engine", () => {
    const pg = createEngine("postgres");
    expect(pg.getDefaultConnectionOptions()).toEqual({
      host: "localhost",
      port: "5432",
      user: "postgres",
    });

    const mysql = createEngine("mysql");
    expect(mysql.getDefaultConnectionOptions()).toEqual({
      host: "localhost",
      port: "3306",
      user: "root",
    });
  });
});
