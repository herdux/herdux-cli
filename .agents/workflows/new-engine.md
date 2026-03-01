---
description: How to add a new database engine to Herdux CLI
---

# Adding a New Database Engine

This workflow defines the **mandatory steps** to add support for a new database engine (e.g., SQLite, MongoDB, SQL Server, Redis).

Before starting, re-read `AGENTS.md` to ensure you understand the architecture.

---

## Prerequisites

- You have identified the client binaries required by the engine (e.g., `sqlite3`, `mongodump`, `sqlcmd`)
- Docker image exists for this engine (for E2E testing)
- The engine supports at least: list databases, create, drop

---

## Step-by-Step Checklist

### 1. Register the engine type

**File:** `src/core/interfaces/database-engine.interface.ts`

Add the new engine name to the `EngineType` union:

```typescript
export type EngineType = "postgres" | "mysql" | "yourengine";
```

> `core/` defines contracts only. Do NOT add logic here.

---

### 2. Create the environment checker

**File:** `src/infra/engines/<yourengine>/<yourengine>-env.ts`

Implement binary validation functions. Pattern to follow: `postgres-env.ts` or `mysql-env.ts`.

```typescript
export async function checkYourEngineClient(): Promise<string> {
  // Use binaryExists() from detect-binary.ts
  // Throw descriptive error with installation instructions if missing
  // Return version string on success
}
```

---

### 3. Create the engine implementation

**File:** `src/infra/engines/<yourengine>/<yourengine>.engine.ts`

Implement the `IDatabaseEngine` interface. Every method is mandatory.

Rules:

- **ALWAYS** use `command-runner.ts` — never call `execa` directly
- **NEVER** print to stdout — return data, let commands handle display
- **NEVER** prompt the user — engines are non-interactive
- **NEVER** read CLI flags — connection options come via `ConnectionOptions`
- Use environment variables for auth (e.g., `MYENGINE_PWD`) — never pass passwords as CLI args when avoidable

Key methods to implement:

```typescript
getHealthChecks(): HealthCheck[]           // 3-4 checks minimum: client binary, backup binary, connection
getEngineName(): string                    // Display name, e.g., "SQLite"
getDefaultConnectionOptions(): ConnectionOptions
checkClientVersion(): Promise<string>
checkBackupRequirements(): Promise<void>
discoverInstances(opts?: ...): Promise<DatabaseInstance[]>
getServerVersion(opts?: ...): Promise<string>
listDatabases(opts?: ...): Promise<DatabaseInfo[]>
createDatabase(name: string, opts?: ...): Promise<void>
dropDatabase(name: string, opts?: ...): Promise<void>
backupDatabase(...): Promise<string>       // Returns output file path
restoreDatabase(...): Promise<void>
```

---

### 4. Register in the engine factory

**File:** `src/infra/engines/engine-factory.ts`

```typescript
import { YourEngine } from "./yourengine/yourengine.engine.js";

export function createEngine(type?: EngineType): IDatabaseEngine {
  switch (type) {
    case "mysql":
      return new MysqlEngine();
    case "yourengine":
      return new YourEngine();
    default:
      return new PostgresEngine();
  }
}
```

---

### 5. Create Docker Compose for E2E

**File:** `infra/docker/compose.e2e-<yourengine>.yml`

Pattern to follow: `compose.e2e-pgsql.yml` or `compose.e2e-mysql.yml`.

Requirements:

- Expose a non-standard port (avoid conflicting with local installations)
- Include a healthcheck so `--wait` works correctly
- Use a pinned image version (e.g., `yourengine:8-alpine`, not `latest`)

---

### 6. Add npm scripts

**File:** `package.json`

```json
"test:e2e:<yourengine>":      "node --no-warnings --experimental-vm-modules node_modules/jest/bin/jest.js -- tests/e2e/<yourengine>/",
"test:e2e:<yourengine>:up":   "docker compose -f infra/docker/compose.e2e-<yourengine>.yml up -d --wait",
"test:e2e:<yourengine>:down": "docker compose -f infra/docker/compose.e2e-<yourengine>.yml down -v --remove-orphans"
```

---

### 7. Create E2E tests

**File:** `tests/e2e/<yourengine>/<yourengine>-workflow.test.ts`

Pattern to follow: `tests/e2e/postgres/postgres-workflow.test.ts`.

The E2E test must cover the full CLI workflow in order:

1. `doctor` — health check passes
2. `version` — server version is returned
3. `create` — creates a test database
4. `list` — test database appears in output
5. `backup` — creates a backup file
6. `drop` — drops the test database
7. `restore` — restores from backup
8. `drop` — cleanup

Use `beforeAll` to start the container and `afterAll` to stop it.

---

### 8. Create unit tests

**Directory:** `tests/unit/`

Cover your engine's methods in isolation using mocks. Pattern to follow: existing unit tests in `tests/unit/commands/` and `tests/unit/infra/`.

At minimum:

- Mock `runCommand` and verify correct binaries and args are called
- Test error handling for missing binaries
- Test `listDatabases` output parsing
- Test `backupDatabase` file naming

---

### 9. Add CI job

**File:** `.github/workflows/ci.yml`

Add a new job following the pattern of `e2e-postgres` or `e2e-mysql`. Ensure it:

- Depends on `lint-and-test`
- Installs the engine's client tools
- Runs `test:e2e:<yourengine>:up`, then tests, then `:down` (always, even on failure)

---

### 10. Update documentation

- `README.md` — add engine to supported engines table and requirements section
- `README.pt-BR.md` — same in Portuguese
- `AGENTS.md` — add engine to the supported engines section

---

### 11. Run pre-commit workflow

Follow `.agents/workflows/pre-commit.md` before committing.
