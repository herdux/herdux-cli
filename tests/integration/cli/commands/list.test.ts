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
});
