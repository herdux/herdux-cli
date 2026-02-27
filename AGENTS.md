# AGENTS.md — Herdux CLI

This file defines **mandatory rules** for AI agents and automated tools working in this repository.  
Violating these rules is considered a bug.

Herdux is a deterministic, engine-agnostic CLI.  
Clarity, separation of concerns, and explicit behavior are non-negotiable.

---

## ROLE & EXPECTATIONS

- Act as a **senior CLI / Node.js engineer**
- Prefer **explicit, boring, predictable code**
- Optimize for **maintainability over cleverness**
- Never introduce hidden behavior or magic defaults
- When in doubt, **fail loudly**

---

## ARCHITECTURE OVERVIEW (MANDATORY)

Herdux follows a strict layered architecture.  
**Layer boundaries MUST NOT be violated.**

src/
├── index.ts # CLI entrypoint (flags & command registration)
├── commands/ # WHAT to do (engine-agnostic verbs)
├── core/ # Pure contracts (interfaces only)
├── infra/ # HOW to do it (engines, config, binaries)
└── presentation/ # HOW to display (logging & output)

---

### core/ — Contracts (Gravitational Center)

- Contains **only interfaces and types**
- Defines `IDatabaseEngine`
- **MUST NOT** import infra, commands, or presentation
- **MUST NOT** reference PostgreSQL, MySQL, Docker, or binaries
- **MUST NOT** contain logic

If something depends on everything else, it belongs here.

---

### infra/ — Implementations

- Contains **all concrete behavior**
- Owns:
  - engine implementations (Postgres, MySQL, etc.)
  - binary execution (`psql`, `mysql`, `pg_dump`, `mysqldump`)
  - config resolution (`~/.herdux/config.json`)
  - environment validation and auto-discovery

Rules:

- **NEVER** execute external binaries outside `infra/`
- **NEVER** bypass `command-runner.ts`
- **NEVER** assume a default engine
- **NEVER** leak engine-specific details to commands

---

### commands/ — CLI Verbs

- Define **user-facing commands** only
- Are **100% engine-agnostic**
- Always resolve engines via `engine-factory`
- Always call:
  - `checkClientVersion()`
  - methods defined in `IDatabaseEngine`

Rules:

- **MUST NOT** call binaries
- **MUST NOT** read config files directly
- **MUST NOT** reference `psql`, `mysql`, or engine internals
- **MUST NOT** contain connection-resolution logic

Commands decide _what_, never _how_.

---

### presentation/ — Output

- Responsible only for formatting and logging
- **MUST NOT** contain business logic
- **MUST NOT** affect control flow

---

## COMMAND FLOW (REFERENCE MODEL)

Example: `hdx --engine mysql list`

index.ts
└── commands/list.ts
└── engine-factory.ts → createEngine("mysql")
└── resolve-connection.ts
└── mysql.engine.ts
└── command-runner.ts (execa wrapper)

This flow is **canonical**.  
Do not invent alternatives.

---

## ENGINE RULES

- Engines implement `IDatabaseEngine`
- Engines:
  - validate required binaries
  - execute commands via `command-runner`
  - return structured results (`stdout`, `stderr`, `exitCode`)
- Engines **MUST NOT**:
  - print directly to stdout
  - prompt the user
  - read CLI flags
  - assume interactive mode

---

## command-runner.ts (CRITICAL)

- Thin wrapper over `execa`
- Standardizes:
  - timeouts
  - env
  - stdin (used for restore)
  - return shape

Rules:

- **ALWAYS** use `command-runner`
- **NEVER** call `execa` directly elsewhere
- **NEVER** change its return contract casually

---

## CONNECTION RESOLUTION

`resolve-connection.ts` owns all connection logic.

Order of precedence:

1. Explicit CLI flags
2. Saved server profiles
3. Auto-discovery (last resort)

Rules:

- **NEVER** duplicate connection logic
- **NEVER** assume host or port defaults
- **NEVER** skip resolution
- In tests (`NODE_ENV=test`), prompts are disabled

---

## infra/docker/ — TEST INFRASTRUCTURE ONLY

This directory contains Docker Compose files for **E2E testing only**.

- One compose file per supported DBMS
- Used exclusively by E2E test helpers

Rules:

- **MUST NOT** be imported or referenced by `src/`
- **MUST NOT** influence runtime behavior
- **MUST NOT** be required to run the CLI

---

## TESTING RULES

### Unit Tests

- Test commands and infra in isolation
- Use mocks and fakes
- No real databases

Notes:

- Unit tests currently focus on PostgreSQL behavior
- When adding MySQL-specific logic, tests **MUST** be extended accordingly

---

### E2E Tests (SOURCE OF TRUTH)

- Run against real databases via Docker
- One full workflow per DBMS
- Validate:
  commands → engine-factory → engine → binaries

Rules:

- **ALWAYS** run E2E tests when changing commands or engines
- **NEVER** assume unit tests are sufficient
- If E2E fails, the code is wrong

---

## engine-factory (CRITICAL PATH)

The engine factory is the single convergence point of the system.

- Resolves and instantiates engines
- Enforces engine validity and availability
- Covered by dedicated tests (`engine-factory.test.ts`)

Rules:

- **NEVER** bypass the factory
- **NEVER** instantiate engines directly
- Any new engine **MUST** be added here and tested

---

## ADDING A NEW COMMAND (MANDATORY CHECKLIST)

When adding a new CLI command:

- Register it in `index.ts`
- Keep it engine-agnostic
- Resolve engine via `engine-factory`
- Call `checkClientVersion()`
- Use only `IDatabaseEngine` methods
- Ensure it works for **all engines** or fails explicitly

Shortcuts are forbidden.

---

## ABSOLUTE PROHIBITIONS

- DO NOT break layer boundaries
- DO NOT introduce engine-specific logic outside `infra/`
- DO NOT add “smart” defaults
- DO NOT add silent fallbacks
- DO NOT bypass factories
- DO NOT mix concerns

When unsure, stop and refactor.

---

## FINAL NOTE

Herdux values **predictability over convenience**.

If a change makes the system harder to reason about,  
it is the wrong change.
