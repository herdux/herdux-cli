# Contributing Guidelines - Herdux CLI

Thank you for your interest in contributing to **Herdux**! 🎉

This document contains the essential guide to understanding the project, running it locally, and submitting your changes. Since Herdux handles databases and potentially destructive commands (like `drop` and `clean`), we take stability and architecture very seriously.

---

## 🏗️ 1. Understanding the Architecture

Before touching any code, it is mandatory to read [AGENTS.md](./AGENTS.md).
It serves as our source of truth regarding Herdux's architecture and defines the strict layers (Commands, Core, Infra, Presentation).

**The Golden Rule:** Commands never execute binaries directly. Everything goes through the `infra/` layer via the `IDatabaseEngine` contract.

---

## 🛠️ 2. Setting Up Your Local Environment

To run and test Herdux, you will need:

- Node.js v18 or newer
- Docker and Docker Compose (for E2E tests)
- Client tools for the engines you intend to test (e.g., `psql`, `mysql`) in your `$PATH`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli

# 2. Install dependencies
npm install

# 3. Transpile TypeScript in Watch mode (optional, for active development)
npm run build -- --watch

# 4. Create a global CLI link for interactive testing in your terminal
npm link

# Now you can use `hdx` globally, pointing to your source code
hdx version # Should display the compiled version
```

_(Optional) Tip_: Use `npm run dev` (`tsx src/index.ts`) if you want to run isolated commands without compiling.

---

## 🧪 3. Running the Tests

We use Jest (running with `--experimental-vm-modules` for native ESM support). No PR will be approved if it does not pass the tests, or if it decreases our coverage without justification.

### Unit Tests

These test function logic, commands, and infrastructure in isolation, using mocks. They do not touch the database.

```bash
npm run test:unit
```

### End-to-End (E2E) Tests - _The Heart of Herdux_

E2E tests spin up real databases using Docker, execute compiled CLI commands (`hdx`), and validate whether the actual behavior (such as dropping a database or creating a backup) succeeds.

To run them, ensure the Docker daemon is running and execute:

**To test PostgreSQL integrations:**

```bash
npm run test:e2e:pgsql
```

**To test MySQL integrations:**

```bash
npm run test:e2e:mysql
```

> **Note:** The E2E scripts handle spinning up and tearing down the containers automatically. However, if a test breaks midway, you may need to clean up the containers manually using `npm run test:e2e:pgsql:down` or its equivalent for MySQL.

---

## 🔥 4. Adding a New Database Engine

This is one of the most common contribution workflows! Want to add support for SQLite, MongoDB, or SQL Server? Follow these high-level steps:

1. **Create the Adapter:** In the `src/infra/engines/YourEngine/` directory, create a class that implements the `IDatabaseEngine` interface (found in `src/core/interfaces/engine.interface.ts`).
2. **Define Safe Commands:** Always use our internal `command-runner.ts` wrapper to execute background binaries.
3. **Register the Engine:** In the engine factory `src/infra/engines/engine-factory.ts`.
4. **Add Unit Tests:** Remove environment dependency by mocking CLI calls.
5. **Add E2E Tests (Mandatory!):** Create a `docker-compose` script in `infra/docker/compose.e2e-yourengine.yml` and replicate the E2E test setup for it.

Never add engine-specific logic to Commands (e.g., `src/commands/backup.ts`).

---

## 🚀 5. How to Submit Your Pull Request (PR)

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-awesome-feature
   # or
   git checkout -b fix/annoying-bug
   ```
2. Commit your changes (we recommend using "Conventional Commits" patterns, e.g., `feat: add sqlite support` or `fix: resolve crash on backup drop`).
3. Format your code by running `npm run lint:fix`.
4. Run **ALL** E2E and unit tests to ensure nothing was broken.
5. Open the Pull Request! Fill out the provided template describing the impact of your changes.

---

## 💬 6. Reporting Bugs & Writing Issues

If you find a bug, please run `hdx doctor` and provide us with the report. Describe your environment, the tools present in your `$PATH`, and the exact steps to reproduce the failure. Please use our Issue Template.

Your contribution, no matter its size, is immensely appreciated.  
Happy coding! 🦬🚀
