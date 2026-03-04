---
description: Testing standards and patterns for Herdux CLI
---

# Testing Standards

Herdux uses a **three-tier testing strategy**. Each tier has a specific role and constraints. Never substitute one for another.

---

## Tier Overview

| Tier        | Location             | Speed  | Requires DB? | Source of truth? |
| ----------- | -------------------- | ------ | ------------ | ---------------- |
| Unit        | `tests/unit/`        | Fast   | No           | No               |
| Integration | `tests/integration/` | Medium | No           | No               |
| E2E         | `tests/e2e/`         | Slow   | Yes (Docker) | **Yes**          |

> If E2E fails, the code is wrong — regardless of passing unit tests.

---

## Running Tests

```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e:pgsql     # E2E tests for PostgreSQL (needs Docker)
npm run test:e2e:mysql     # E2E tests for MySQL (needs Docker)
npm run test:e2e           # All E2E tests

# Run with branch coverage report
npm run test:unit -- --coverage
```

---

## Unit Tests

### Purpose

Test commands and infra modules in isolation. No real databases, no real binaries, no filesystem side effects.

### Framework

Jest 30 with `ts-jest` (ESM mode via `--experimental-vm-modules`).

### Mocking pattern (mandatory for ESM)

Use `jest.unstable_mockModule` — this is required for ESM dynamic imports. Never use `jest.mock` with static imports in this codebase.

```typescript
import { jest } from "@jest/globals";

// Must be declared BEFORE the module under test is imported
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

jest.unstable_mockModule("ora", () => ({
  default: jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
  })),
}));

// Dynamic import AFTER mocks are set up
const { registerMyCommand } = await import("../../src/commands/my-command.js");
```

### Multi-engine parametrization (mandatory for command tests)

Every command test MUST be parametrized over all supported engines using `describe.each` and the shared `engines` helper.

```typescript
import { engines } from "../helpers/engines.js";

describe.each(engines)(
  "registerMyCommand ($engineName)",
  ({ engineType, engineName, defaultOpts }) => {
    beforeEach(() => {
      mockResolveEngineAndConnection.mockResolvedValue({
        engine: mockEngine,
        engineType,
        opts: defaultOpts,
      });
    });

    it("does something", async () => { ... });
  },
);
```

**When adding a new engine**, update `tests/unit/helpers/engines.ts` to include the new entry. All command tests will automatically run against it.

### Standard mock engine structure

```typescript
const mockEngine = {
  getEngineName: jest.fn().mockReturnValue("PostgreSQL"),
  checkClientVersion: jest.fn().mockResolvedValue("psql 16.0"),
  checkBackupRequirements: jest.fn().mockResolvedValue(undefined),
  discoverInstances: jest.fn().mockResolvedValue([]),
  getServerVersion: jest.fn().mockResolvedValue("PostgreSQL 16.0"),
  listDatabases: jest.fn().mockResolvedValue([]),
  createDatabase: jest.fn().mockResolvedValue(undefined),
  dropDatabase: jest.fn().mockResolvedValue(undefined),
  backupDatabase: jest.fn().mockResolvedValue("/tmp/backup.dump"),
  restoreDatabase: jest.fn().mockResolvedValue(undefined),
  getHealthChecks: jest.fn().mockReturnValue([]),
  getDefaultConnectionOptions: jest.fn().mockReturnValue({}),
};
```

### Standard command mock structure

Every command builder method used in the chain MUST be present in the mock. Missing methods cause silent test failures.

```typescript
const command = {
  alias: jest.fn().mockReturnThis(),
  description: jest.fn().mockReturnThis(),
  addHelpText: jest.fn().mockReturnThis(), // required since Phase 3
  option: jest.fn().mockReturnThis(),
  action(fn: ActionFn) {
    capturedAction = fn;
    return this;
  },
};
```

### Process.exit and console spies

```typescript
let exitSpy: jest.SpiedFunction<typeof process.exit>;

beforeAll(() => {
  exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("PROCESS_EXIT_MOCK");
  });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock implementations to safe defaults
});
```

---

## Coverage Requirements

### Thresholds (enforced in jest.config.js)

```
statements:  95%
functions:   95%
lines:       95%
branches:    95%
```

Branch coverage is the hardest to achieve. Pay special attention to conditional paths.

### Mandatory cases for every command

| Case                       | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| Happy path                 | Successful execution end-to-end                                        |
| Engine throws `Error`      | `mockEngine.someMethod.mockRejectedValue(new Error("msg"))`            |
| Engine throws non-Error    | `mockEngine.someMethod.mockRejectedValue("raw string error")`          |
| `checkClientVersion` fails | Binary not found or version check error                                |
| Invalid user input         | When the command validates arguments (name, format, etc.)              |
| Outer catch triggered      | Make `resolveEngineAndConnection` throw to cover the outer `try/catch` |

### Covering the OR-fallback branch

Many commands have patterns like:

```typescript
const dir =
  cmdOpts.output ||
  configDefaults.output ||
  join(homedir(), ".herdux", "backups");
```

Each `||` creates two branches. You MUST test both sides:

```typescript
// Branch 1: configDefaults.output IS set (left side taken)
mockConfigGetDefault.mockReturnValue({ output: "/custom/dir" });

// Branch 2: configDefaults.output is NOT set (right side taken)
mockConfigGetDefault.mockReturnValue({});
```

### Covering the non-Error branch in catch blocks

Every `catch` block that uses `err instanceof Error ? err.message : String(err)` has two branches. Test both:

```typescript
// Branch 1: Error instance
mockEngine.someMethod.mockRejectedValue(new Error("connection lost"));

// Branch 2: non-Error value (string, plain object, etc.)
mockEngine.someMethod.mockRejectedValue("raw string error");
```

### Covering nullish coalescing

Patterns like `db.owner ?? ""` require tests where the value is `undefined` or `null`:

```typescript
mockListDatabases.mockResolvedValue([
  { name: "db1" }, // owner and encoding are undefined
  { name: "db2", owner: null, encoding: null },
]);
```

---

## Integration Tests

### Purpose

Test CLI behavior end-to-end via subprocess execution, without a real database. Validates that commands wire together correctly and that output/exit codes are correct.

### CliRunner helper

Location: `tests/integration/cli/helpers/cli-runner.ts`

The `CliRunner` class:

- Creates an isolated temp directory for `~/.herdux/config.json`
- Runs the compiled CLI via Node.js subprocess using `execa`
- Supports injecting environment variables (`HERDUX_CONFIG_DIR`, `FORCE_COLOR`, `HERDUX_TEST_FORCE_TTY`)
- Cleans up the temp directory after each test

```typescript
const runner = new CliRunner();

beforeEach(() => runner.setup());
afterEach(() => runner.teardown());

const result = await runner.run(["list", "--engine", "postgres"]);
expect(result.exitCode).toBe(0);
```

### Timeout

10 seconds per test. If a test needs more, investigate why — integration tests should not be slow.

---

## E2E Tests

### Purpose

Validate the **complete CLI workflow** against a real database running in Docker. This is the source of truth for whether the code is correct.

### Setup pattern

```typescript
beforeAll(async () => {
  // Start Docker container
  await execa("npm", ["run", "test:e2e:<engine>:up"]);
  // Set up temp directory for config
}, 120_000);

afterAll(async () => {
  // Always stop container, even if tests fail
  await execa("npm", ["run", "test:e2e:<engine>:down"]);
}, 120_000);
```

### Workflow order (mandatory)

E2E tests must follow this order to be self-contained:

1. `doctor` — validates the environment
2. `version` — validates server connectivity
3. `config` — set/get/list/reset
4. `create` — create test database
5. `list` — verify test database appears
6. `backup` — create backup (store path for later)
7. `drop` — drop test database
8. `restore` — restore from backup
9. `drop` — cleanup

### CLI helpers for E2E

Each engine has a helper at `tests/e2e/<engine>/helpers/cli.ts` that wraps `execa` with the engine's test connection options (host, port, user, password).

### Timeout

120 seconds per test (Docker startup + real operations). Never reduce this.

### Rule: Never assume unit tests are sufficient

If you change any engine method or command, run the corresponding E2E tests. Unit tests passing does not guarantee E2E will pass.

---

## What NOT to do

- Do not use `jest.mock()` with static strings — use `jest.unstable_mockModule()` for ESM
- Do not call real binaries in unit tests
- Do not write integration tests that depend on a real database
- Do not skip E2E tests when modifying engine behavior
- Do not set E2E timeout below 120s
- Do not write tests that depend on execution order within a `describe` block (except E2E workflows by design)
- Do not omit `addHelpText: jest.fn().mockReturnThis()` from command mocks
- Do not leave OR-fallback branches or non-Error catch branches uncovered
