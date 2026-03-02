🇺🇸 English | 🇧🇷 [Português](./README.pt-BR.md)

<p align="center">
  <strong>Infrastructure-grade power. Developer-grade experience.</strong>
</p>

<p align="center">
  <img src=".github/assets/logo.svg" alt="Herdux banner" style="max-width: 100%; width: 600px;" />
</p>

## Herdux — Database Workflow CLI

A fast, interactive CLI that removes friction from daily local database workflows, especially when juggling multiple instances and large datasets.

![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=flat&logo=github)](https://github.com/sponsors/eduardozaniboni)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/eduardozaniboni)

> Optimized for local and development environments. Production use is supported with explicit configuration.

---

## Quick Start

```bash
npm install -g herdux-cli

# Use either 'herdux' or the shorter 'hdx' alias
hdx doctor
herdux list
```

---

## Supported Engines

| Engine     | Status | Client Tools Required           |
| ---------- | ------ | ------------------------------- |
| PostgreSQL | ✅     | `psql`, `pg_dump`, `pg_restore` |
| MySQL      | ✅     | `mysql`, `mysqldump`            |
| SQLite     | ✅     | `sqlite3`                       |

Use `--engine <name>` or configure the engine in a saved profile. PostgreSQL is the default.

```bash
herdux list                        # PostgreSQL (default)
herdux --engine mysql list         # MySQL
herdux --engine sqlite list        # SQLite (file-based, no server required)
herdux list -s my-profile          # Using a saved server profile
```

---

## Why Herdux?

Managing local databases through raw binaries is repetitive, error-prone, and different for every engine.

**Before:**

```bash
# PostgreSQL backup
pg_dump -U postgres -h localhost -p 5416 -Fc -f ./backups/mydb.dump mydb

# MySQL backup
mysqldump -u root -h localhost -P 3306 -p mydb > ./backups/mydb.sql

# Different flags, different tools, different muscle memory for each engine.
```

**After:**

```bash
herdux backup mydb --drop --yes        # Backup + drop in one shot
herdux restore ./backups/mydb.dump --db mydb   # Detects format, creates DB if missing
herdux clean                            # Multi-select and batch-drop databases
herdux doctor                           # Full system health check
```

Same commands. Any engine. Fewer flags. Fewer mistakes. Zero terminal fatigue.

---

## Requirements

- **Node.js** 18 or higher
- **For PostgreSQL:** `psql`, `pg_dump`, `pg_restore` installed and in your `PATH`
- **For MySQL:** `mysql`, `mysqldump` installed and in your `PATH`
- **For SQLite:** `sqlite3` installed and in your `PATH`

> [!TIP]
> Run `herdux doctor` after installation to verify everything is correctly set up.

---

## Installation

**npm (recommended):**

> **Important:** Use the `-g` flag so the CLI is accessible anywhere in your terminal.

```bash
npm install -g herdux-cli
```

**From source:**

```bash
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli
npm install
npm run build
npm link
```

---

## Commands

### `herdux version`

Shows the CLI version and the connected database server version.

```bash
herdux version
herdux --engine mysql version
```

### `herdux doctor`

Runs a full system health check: verifies client tools, tests connectivity, and validates authentication.

```bash
herdux doctor
herdux --engine mysql doctor
```

---

### `herdux list`

Lists all databases on the connected server.

```bash
herdux list              # Name, owner, encoding
herdux ls --size         # Includes disk size, sorted largest to smallest
```

> [!NOTE]
> The `--size` flag calculates physical disk usage. On servers with dozens of multi-GB databases, this may take a few minutes.

---

### `herdux create <name>`

Creates a new database.

```bash
herdux create my_new_db
herdux --engine mysql create my_new_db
```

### `herdux drop <name>`

Drops a database with interactive confirmation.

```bash
herdux drop my_old_db
```

---

### `herdux clean`

Interactive bulk cleanup: multi-select databases, optionally back them up, and batch-drop them.

```bash
herdux clean
```

Aborts immediately if any safety backup fails. No data is dropped without a confirmed backup.

---

### `herdux backup <database>`

Creates a timestamped backup in `~/.herdux/backups/` by default.

```bash
herdux backup mydb                       # Engine-native format (.dump for PG, .db for SQLite, .sql for MySQL)
herdux backup mydb --format plain        # Plain SQL (.sql)
herdux backup mydb --drop                # Backup, then prompt to drop
herdux backup mydb --drop --yes          # Backup + drop, no confirmation
herdux backup mydb -o ./my-backups       # Custom output directory
```

| Option                | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `-F, --format <type>` | `custom` (default, engine-native) or `plain` (SQL)    |
| `-d, --drop`          | Prompt to drop the database after a successful backup |
| `-y, --yes`           | Skip drop confirmation (requires `--drop`)            |
| `-o, --output <dir>`  | Output directory (default: `~/.herdux/backups`)       |

---

### `herdux restore <file>`

Restores a database from a backup file. Auto-detects the format based on file extension.

```bash
herdux restore ./backups/mydb_2026-02-23.dump --db mydb
herdux restore ./exports/data.sql --db mydb
herdux restore archive.bkp --db mydb --format custom   # Override auto-detection
```

The target database is automatically created if it does not exist.

> [!NOTE]
> When restoring dumps from managed environments (e.g. AWS RDS), Herdux configures the restore tool to ignore ownership and role assignments, preventing errors from missing production roles.

---

## Configuration & Server Profiles

Configuration is stored at `~/.herdux/config.json`.

### Global defaults

```bash
herdux config set engine postgres
herdux config set user postgres
herdux config set password my_secret
herdux config set port 5432
```

### Named server profiles

```bash
herdux config add pg16 --port 5416
herdux config add pg17 --port 5417 --user admin
herdux config add mysql-dev --port 3306 --user root --password secret --engine mysql
herdux config add staging --host 192.168.0.10 --port 5432
```

Use profiles with the `-s` flag:

```bash
herdux list -s pg16
herdux backup mydb -s mysql-dev
```

### Manage config

```bash
herdux config list           # Show all settings and profiles
herdux config get port       # Get a specific value
herdux config rm pg16        # Remove a profile
herdux config reset          # Clear all configuration
```

---

## Connection & Engine Resolution

Herdux follows a strict, predictable priority when resolving how to connect.

**Engine priority:**

| Priority | Source         | Example                          |
| -------- | -------------- | -------------------------------- |
| 1        | CLI flag       | `herdux --engine mysql list`     |
| 2        | Server profile | Profile's `engine` field         |
| 3        | Saved default  | `herdux config set engine mysql` |
| 4        | Fallback       | `postgres`                       |

**Connection priority:**

| Priority | Source         | Example                                       |
| -------- | -------------- | --------------------------------------------- |
| 1        | CLI flags      | `herdux list --port 5417`                     |
| 2        | Server profile | `herdux list -s pg16`                         |
| 3        | Saved defaults | `herdux config set port 5432`                 |
| 4        | Auto-discovery | Scans common ports; prompts if multiple found |

Explicit input always wins. No surprises.

---

## Contributing

```bash
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli
npm install

npm run test:unit           # Unit tests (238 tests, all engines)
npm run test:integration    # Integration tests
npm run test:e2e:pgsql      # E2E tests for PostgreSQL (requires Docker)
npm run test:e2e:mysql      # E2E tests for MySQL (requires Docker)
npm run test:e2e:sqlite     # E2E tests for SQLite (requires sqlite3)
```

Herdux follows strict architectural boundaries: commands are engine-agnostic, engines encapsulate all database-specific behavior, and all binaries are isolated behind adapters. Keep these boundaries intact when contributing.

PRs are welcome. Open an issue first for major changes.

---

## Support

If Herdux has saved you hours of debugging and database wrangling, consider supporting the project:

<a href="https://github.com/sponsors/eduardozaniboni" target="_blank"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github" alt="GitHub Sponsors"></a>
<a href="https://www.buymeacoffee.com/eduardozaniboni" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 28px !important;width: 100px !important;" ></a>

---

## License

MIT
