import { jest } from "@jest/globals";
import { CliRunner } from "../helpers/cli-runner.js";

describe("CLI Integration: hdx list", () => {
  let runner: CliRunner;

  beforeEach(() => {
    runner = new CliRunner();
  });

  afterEach(() => {
    runner.cleanup();
  });

  it("should output 'Auto-selected connection' when filtering by engine yields 1 choice", async () => {
    runner.mockConfig({
      servers: {
        "pgsql-local": { engine: "postgres", port: "5432" },
        "mysql-local": { engine: "mysql", port: "3306" },
      },
    });

    const result = await runner.run(["list", "--engine", "mysql"]);

    // Assert it bypassed the interactive selection by going straight to the MySQL engine's auto-select
    expect(result.stdout).toContain("Auto-selected connection: › mysql-local");
    expect(result.stdout).not.toContain("Select a connection to use:");
  });

  it("should show the interactive prompt when no specific engine is passed", async () => {
    runner.mockConfig({
      servers: {
        "pgsql-local": { engine: "postgres", port: "5432" },
        "mysql-local": { engine: "mysql", port: "3306" },
      },
      default: { engine: "postgres", port: "5432" },
    });

    // We pass reject: false so the test doesn't crash if we kill it
    // And we set a relatively short timeout to test the prompt rendering
    const processPromise = runner.run(["list"]);

    // Give the prompt a second to render
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Send a kill signal to unblock the test suite
    processPromise.kill("SIGTERM");

    const result = await processPromise;

    // It should render the interactive prompt correctly
    expect(result.stdout).toContain("Select a connection to use:");
    expect(result.stdout).toContain("pgsql-local");
    expect(result.stdout).toContain("mysql-local");
  });

  it("should not show the interactive prompt when --engine sqlite is passed", async () => {
    runner.mockConfig({
      servers: {
        "pgsql-local": { engine: "postgres", port: "5432" },
        "mysql-local": { engine: "mysql", port: "3306" },
      },
    });

    const result = await runner.run(["list", "--engine", "sqlite"]);

    // SQLite is file-based and has no server instances to select from.
    // The interactive selection prompt must not appear.
    expect(result.stdout).not.toContain("Select a connection to use:");
    expect(result.stdout).not.toContain("pgsql-local");
    expect(result.stdout).not.toContain("mysql-local");
  });

  it("should auto-select when filtering by engine yields exactly one SQLite server", async () => {
    runner.mockConfig({
      servers: {
        "pgsql-local": { engine: "postgres", port: "5432" },
        "sqlite-local": { engine: "sqlite", host: "/tmp/herdux-test" },
      },
    });

    const result = await runner.run(["list", "--engine", "sqlite"]);

    expect(result.stdout).toContain("Auto-selected connection: › sqlite-local");
    expect(result.stdout).not.toContain("Select a connection to use:");
  });

  it("should reject an unknown engine and list all valid engines including sqlite", async () => {
    const result = await runner.run(["list", "--engine", "badengine"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown engine");
    expect(result.stderr).toContain("postgres");
    expect(result.stderr).toContain("mysql");
    expect(result.stderr).toContain("sqlite");
  });
});
