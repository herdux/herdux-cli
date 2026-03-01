---
description: Guidelines for safely refactoring Herdux CLI code
---

# Refactoring Guidelines

Refactoring in Herdux means improving the internal structure **without changing observable behavior**. If any CLI output, exit code, or file produced by a command changes, it is not a refactor — it is a feature change and requires its own branch and PR.

---

## Before You Start

1. Re-read `AGENTS.md` — understand which layer you are touching
2. Identify which tests currently cover the code you are changing
3. Run those tests locally so you have a baseline: they must all pass before and after

```bash
npm run test:unit
npm run lint:check
npm run build
```

---

## Layer-Specific Rules

### Refactoring `commands/`

- Commands must remain engine-agnostic after refactoring
- Extracting shared logic from two commands → create a helper **inside `commands/`** only if it is command-display logic; if it is engine/config logic, it belongs in `infra/`
- Never move business logic into commands during a refactor

### Refactoring `infra/engines/`

- After any change to an engine, run the full E2E suite for that engine
- If you extract a private function, keep it in the same file unless it is reusable across engines — in that case, put it in `infra/engines/` (not `core/`)
- Never expose engine internals through the `IDatabaseEngine` interface just to make testing easier — use dependency injection or factory patterns instead

### Refactoring `infra/engines/resolve-connection.ts`

This is the most complex file in the codebase. Extra care required:

- Any change here affects **all commands** — run the full unit test suite
- The public signature of `resolveEngineAndConnection()` must not change
- Test TTY and non-TTY paths explicitly (use `HERDUX_TEST_FORCE_TTY`)
- Test single-server and multi-server auto-discovery paths

### Refactoring `core/interfaces/`

- **Only additive changes allowed** — never remove or rename existing interface members
- Adding an optional field: acceptable
- Adding a required method to `IDatabaseEngine`: requires implementing it in ALL engines immediately

### Refactoring `command-runner.ts`

- The return shape `{ stdout, stderr, exitCode }` is a stable contract — do not change field names
- Timeout changes affect all commands — test backup/restore with large databases if increasing
- Changes here require a full E2E run for at least one engine

---

## Safe Refactoring Patterns

### Extracting a private function

Acceptable within any file. The extracted function should be:

- Pure (no side effects) when possible
- Located in the same file, at the bottom, clearly separated

### Splitting a large file

If a file exceeds ~300 lines and has clearly separate concerns:

1. Identify the boundary (e.g., `resolve-connection.ts` mixes prompt logic with resolution logic)
2. Extract to a sibling file with a descriptive name
3. Re-export from the original file if needed to avoid import changes downstream
4. Run all tests

### Renaming internal variables or types

Acceptable as long as the public API (exported functions, interface members) stays the same.

### Simplifying conditional logic

Always check that edge cases are still covered. Run unit tests after simplification.

---

## What is NOT a Refactor

Do not call these refactors — they require separate branches:

- Changing CLI flag names or command names
- Changing output format (column order, spacing, labels)
- Adding or removing engine capabilities
- Changing config file schema
- Changing default values

---

## After Refactoring

Run the full validation sequence:

```bash
npm run lint:check     # Formatting must pass
npm run build          # TypeScript must compile cleanly
npm run test:unit      # All unit tests must pass
```

If you touched engine code:

```bash
npm run test:e2e:pgsql    # or mysql, depending on which engine
```

If you touched `resolve-connection.ts` or `command-runner.ts`:

```bash
npm run test:e2e:pgsql
npm run test:e2e:mysql
```

---

## Commit Discipline

Each refactoring commit must be atomic — one logical change per commit. Do not bundle a refactor with a bug fix or a feature. If you discover a bug while refactoring, create a separate branch for the fix.

Follow `.agents/workflows/pre-commit.md` before committing.
