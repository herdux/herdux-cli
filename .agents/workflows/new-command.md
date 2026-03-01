---
description: How to add a new CLI command to Herdux CLI
---

# Adding a New CLI Command

This workflow defines the **mandatory steps** to add a new user-facing command (e.g., `hdx snapshot`, `hdx migrate`, `hdx schedule`).

Before starting, re-read `AGENTS.md` to ensure you understand the architecture.

---

## Core Rule

Commands decide **what** to do, never **how**. All database logic lives in `infra/`. A command file must be readable as plain English — no binary names, no connection logic, no config reads.

---

## Step-by-Step Checklist

### 1. Create the command file

**File:** `src/commands/<name>.ts`

Structure to follow (every command uses this same pattern):

```typescript
import { Command } from "commander";
import ora from "ora";
import { logger } from "../presentation/logger.js";
import { resolveEngineAndConnection } from "../infra/engines/resolve-connection.js";

export function register<Name>Command(program: Command): void {
  program
    .command("<name>")
    .description("Clear, user-facing description of what this command does.")
    .option("-x, --example <value>", "Description of this option", "default")
    .addHelpText(
      "after",
      `
Examples:
  hdx <name>
  hdx <name> --example value
  hdx --engine mysql <name>
`
    )
    .action(async (options) => {
      // 1. Resolve engine and connection (always first)
      const { engine, opts } = await resolveEngineAndConnection(
        program.opts(),
        options
      );

      // 2. Validate client binary
      const spinner = ora("Checking client...").start();
      try {
        await engine.checkClientVersion();
        spinner.stop();
      } catch (err) {
        spinner.fail("Client not available.");
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      // 3. Execute the command logic using only IDatabaseEngine methods
      // ...

      logger.success("Done.");
    });
}
```

Rules for the command file:

- **MUST** call `resolveEngineAndConnection()` before anything database-related
- **MUST** call `checkClientVersion()` before any engine operation
- **MUST NOT** import from `infra/engines/postgres/`, `infra/engines/mysql/`, or any engine directly
- **MUST NOT** import `config.service.ts` directly
- **MUST NOT** contain connection logic (host, port, user resolution)
- **MUST NOT** reference binary names (`psql`, `mysql`, `pg_dump`, etc.)

---

### 2. Register the command in the entry point

**File:** `src/index.ts`

```typescript
import { register<Name>Command } from "./commands/<name>.js";

// Inside the program setup:
register<Name>Command(program);
```

Commands are registered in the order they appear in `--help`. Place the new command logically relative to existing ones.

---

### 3. Extend IDatabaseEngine if needed

**File:** `src/core/interfaces/database-engine.interface.ts`

If the command requires a new engine capability not yet defined:

1. Add the method signature to `IDatabaseEngine`
2. Implement it in `src/infra/engines/postgres/postgres.engine.ts`
3. Implement it in `src/infra/engines/mysql/mysql.engine.ts`
4. Implement it in any other registered engine

> Every engine must implement every method. Partial implementations are not allowed.

---

### 4. Write unit tests

**File:** `tests/unit/commands/<name>.test.ts`

Pattern to follow: `tests/unit/commands/backup.test.ts` or `tests/unit/commands/list.test.ts`.

Every unit test must:

- Mock `resolveEngineAndConnection` via `jest.unstable_mockModule`
- Mock `ora` to suppress spinner output
- Spy on `process.exit`, `console.log`, `console.error`
- Cover: happy path, error from engine, missing binary, invalid options

```typescript
import { jest } from "@jest/globals";

const mockEngine = {
  checkClientVersion: jest.fn(),
  // ... other methods as jest.fn()
};

jest.unstable_mockModule(
  "../../src/infra/engines/resolve-connection.js",
  () => ({
    resolveEngineAndConnection: jest.fn().mockResolvedValue({
      engine: mockEngine,
      engineType: "postgres",
      opts: { host: "localhost", port: "5432", user: "postgres" },
    }),
  }),
);
```

---

### 5. Add to E2E workflows

**Files:**

- `tests/e2e/postgres/postgres-workflow.test.ts`
- `tests/e2e/mysql/mysql-workflow.test.ts`

Add a test case for the new command within each engine's workflow. E2E tests run in sequence — place the new command's test at a logical point in the flow.

---

### 6. Update documentation

- `README.md` — add the command to the commands table with description and flags
- `README.pt-BR.md` — same in Portuguese

If the command introduces new flags available globally, update the global flags section too.

---

### 7. Run pre-commit workflow

Follow `.agents/workflows/pre-commit.md` before committing.
