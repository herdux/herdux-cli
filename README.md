🇺🇸 English | 🇧🇷 [Português](./README.pt-BR.md)

<p align="center">
  <strong>Infrastructure-grade power. Developer-grade experience.</strong>
</p>

<p align="center">
  <img src=".github/assets/logo.svg" alt="Herdux banner" style="max-width: 100%; width: 600px;" />
</p>

## ⏭️ Herdux — Database Workflow CLI

A fast, interactive CLI that removes friction from daily local database workflows, especially when juggling multiple instances and large datasets.

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=flat&logo=github)](https://github.com/sponsors/eduardozaniboni)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/eduardozaniboni)

> Optimized for local and development environments. Production use is supported with explicit configuration.

<!-- <p align="center">
  <img src=".github/herdux.gif" alt="herdux terminal gif" width="1220" />
</p> -->

---

## ⚡ Quick Start

```bash
npm install -g herdux-cli

# You can use either 'herdux' or the shorter 'hdx' alias
hdx doctor
herdux list
```

That's it. You're managing databases.

---

## 🔌 Supported Engines

| Engine     | Status | Client Tools Required           |
| ---------- | ------ | ------------------------------- |
| PostgreSQL | ✅     | `psql`, `pg_dump`, `pg_restore` |
| MySQL      | ✅     | `mysql`, `mysqldump`            |

Herdux resolves the engine explicitly using a strict priority order (CLI flags → profiles → saved defaults → fallback).

Internally, no command ever runs without a fully resolved engine.

```bash
# PostgreSQL (default)
herdux list
herdux create mydb

# MySQL
herdux --engine mysql list
herdux --engine mysql create mydb

# Or save it in a profile and forget about it
herdux config add mysql-local --port 3306 --user root --password secret --engine mysql
herdux list -s mysql-local
```

---

## 🧠 How Herdux Thinks

Herdux is designed around **strict separation of concerns**:

- **Commands decide _what_ to do**
- **Engines decide _how_ to do it**
- **Binaries are never called directly by commands**
- **All external behavior is isolated behind engine contracts**

This architecture guarantees:

- predictable behavior
- engine-agnostic commands
- safer destructive operations
- easier extension to new databases

If something feels “magical”, it’s probably wrong.

Any change that breaks these boundaries is considered a bug.

---

## Why Herdux?

Managing local databases through raw bash scripts or binaries is repetitive, error-prone, and painful at scale.

### ❌ Without Herdux

```bash
# PostgreSQL backup
pg_dump -U postgres -h localhost -p 5416 -Fc -f ./backups/mydb.dump mydb

# MySQL backup
mysqldump -u root -h localhost -P 3306 -p mydb > ./backups/mydb.sql

# Manually drop, restore, check tools...
# Different flags, different tools, different muscle memory for each engine.
```

### ✅ With Herdux

```bash
herdux backup mydb --drop --yes        # Backup + drop in one shot
herdux restore ./backups/mydb.dump --db mydb   # Auto-creates DB if missing & detects format
herdux clean                            # Multi-select and batch-drop databases
herdux doctor                           # Full system health check
```

Same commands. Any engine. Fewer flags. Fewer mistakes. Zero terminal fatigue.

---

## 🎯 Who is Herdux for?

**Herdux** was built _for developers, by developers_.

It was born from the daily frustration of constantly having to restore backups to test specific states, drop corrupted databases during development, and juggle raw database binaries.

It is specifically designed for developers who:

- Manage local infrastructures and need to check disk sizes before seeding new databases.
- Want to quickly clone, seed, and reset databases without reading `man` pages.
- Need safe backup & restore workflows that don't rely on fragile bash scripts.
- Prefer terminal-first tooling.
- Want predictable connection resolution without hidden magic.
- Work with **multiple database engines** (PostgreSQL, MySQL) and want a unified interface.

If you manage databases locally, Herdux was created to solve your pain.

---

## 🚀 Key Features

- **🔌 Multi-Engine Support** — First-class support for PostgreSQL and MySQL. Same commands, same workflow, any engine.
- **📋 Smart Listing** — Optimized listing strategy for massive clusters. Optional `--size` flag for disk usage analysis, sorted largest-first.
- **💾 Intelligent Backup & Restore** — Supports Custom (`.dump`) and Plain (`.sql`) formats. Auto-detects the right tool for restores.
- **🧹 Bulk Cleanup** — Multi-select databases, optionally backup, and batch-drop them. Reclaim disk space instantly.
- **🩺 System Diagnostics** — One-command health check verifying binaries, authentication, and connectivity.
- **⚙️ Persistent Profiles** — Save named server configurations with engine type. Switch between environments with `-s pg16`.
- **🎯 Smart Connection & Engine Resolution** — Explicit CLI flags → profiles → saved defaults → auto-discovery. Always predictable.

---

## 💡 Philosophy

**Herdux** combines _herd_ and _UX_ — delivering a better developer experience when managing your local database clusters. The name reflects our focus on improving the developer experience of managing database herds.

**Herdux** follows three principles:

- **Safety first** — Never drops data without explicit confirmation or a verified backup.
- **Explicit over implicit** — Connection and engine resolution follows a strict, documented priority. No magic.
- **Developer workflow optimization** — Every command is designed to save you from repetitive terminal work.

---

## 🔒 Safety

**Herdux** handles destructive operations with care:

- **Never drops a database** unless explicit confirmation is given
- **Aborts the entire operation** if a safety backup fails during `herdux clean`
- **Validates backup tool exit codes** before considering a backup successful
- **Requires `--drop` flag** intentionally — dropping is never the default
- **`--yes` must be combined with `--drop`** — cannot skip confirmation alone

> If you request a backup before dropping and that backup fails, **Herdux** stops immediately. No data is lost.

---

## 🧩 Requirements

- **Node.js** 18 or higher
- **For PostgreSQL:** `psql`, `pg_dump`, `pg_restore` installed and available in your `PATH`
- **For MySQL:** `mysql`, `mysqldump` installed and available in your `PATH`

> [!TIP]
> Run `herdux doctor` after installation to verify everything is set up correctly. The doctor command checks the tools for the active engine.

---

## 📦 Installation

**npm (recommended):**

> **⚠️ IMPORTANT:** You must use the `-g` (global) flag for the CLI to be accessible anywhere in your terminal.

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

## 🛠️ Commands

All commands work with both PostgreSQL and MySQL. Use `--engine mysql` or configure engine in your server profile.

### `herdux version`

Shows the CLI version and the connected database server version.

```bash
herdux version
herdux --engine mysql version
```

### `herdux doctor`

Runs a full system health check:

- Verifies the required client tools are installed and reachable (engine-specific)
- Attempts a live connection using the resolved configuration
- Tests authentication against the target server

```bash
herdux doctor
herdux --engine mysql doctor
```

---

### 📋 `herdux list`

Lists all databases on the connected server.

```bash
herdux list              # Fast listing (name, owner, encoding)
herdux ls --size         # Includes disk size, sorted largest → smallest
```

> [!NOTE]
> The `--size` flag calculates physical disk usage. On servers with dozens of multi-GB databases, this may take a few minutes depending on disk speed.

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

### 🧹 `herdux clean` — Bulk Cleanup

Working with seed-heavy development databases? Need to reclaim disk space fast?

`herdux clean` allows you to:

- **Multi-select** databases from an interactive checkbox UI
- **Optionally generate safety backups** before any destructive action
- **Batch-drop** all selected databases safely
- **Abort immediately** if any backup fails, preventing data loss

```bash
herdux clean
```

This is designed for the real-world dev workflow: clone databases, experiment, then clean up everything in one shot.

---

### 📦 `herdux backup <database>`

Generates a timestamped backup in `./backups/`.

```bash
herdux backup mydb                       # Custom format (.dump for PG, .sql for MySQL)
herdux backup mydb --format plain        # Plain SQL (.sql)
herdux backup mydb --drop                # Backup, then ask to drop
herdux backup mydb --drop --yes          # Backup + drop, no questions
herdux backup mydb -o ./my-backups       # Custom output directory
```

| Option                | Description                                         |
| --------------------- | --------------------------------------------------- |
| `-F, --format <type>` | `custom` (default, compressed) or `plain` (raw SQL) |
| `-d, --drop`          | Prompt to drop database after successful backup     |
| `-y, --yes`           | Skip drop confirmation (requires `--drop`)          |
| `-o, --output <dir>`  | Output directory (default: `./backups`)             |

---

### 📥 `herdux restore <file>`

Restores a database from a backup file. Automatically detects the format:

- `.sql` → uses the appropriate SQL import tool
- `.dump` or any other extension → uses the appropriate restore tool

```bash
herdux restore ./backups/mydb_2026-02-23.dump --db mydb
herdux restore ./exports/data.sql --db mydb
```

Need to override auto-detection? Use `--format`:

```bash
herdux restore archive.bkp --db mydb --format custom
herdux restore script.txt --db mydb --format plain
```

> [!NOTE]
> When restoring dumps from managed environments (e.g., AWS RDS), Herdux automatically configures the underlying engine to ignore ownership and role assignments. This prevents errors caused by production roles that do not exist locally. If the restore engine completes with non-fatal warnings (such as missing roles), Herdux will inform you and proceed normally rather than failing.

---

## ⚙️ Configuration & Server Profiles

`herdux` stores configuration locally at `~/.herdux/config.json`.

### Set Global Defaults

```bash
herdux config set engine postgres        # Default engine
herdux config set user postgres
herdux config set password my_secret
herdux config set port 5432
```

### Named Server Profiles

Manage multiple database instances effortlessly:

```bash
# PostgreSQL profiles
herdux config add pg16 --port 5416
herdux config add pg17 --port 5417 --user admin

# MySQL profiles (engine is saved in the profile)
herdux config add mysql-dev --port 3306 --user root --password secret --engine mysql

# Remote servers
herdux config add staging --host 192.168.0.10 --port 5432
```

Then connect using the `-s` flag:

```bash
herdux list -s pg16
herdux backup mydb -s mysql-dev
```

Or just run a command without flags — if you have saved profiles, Herdux will show an interactive selection menu displaying the engine for each profile.

### View & Manage Config

```bash
herdux config list           # Show all saved settings and profiles
herdux config get port       # Get a specific value
herdux config rm pg16        # Remove a server profile
herdux config reset          # Clear all configuration
```

---

## 🔌 Connection & Engine Resolution

When resolving how to connect and which engine to use, **Herdux** follows a strict, predictable priority order:

### Engine Priority

| Priority | Source             | Example                          |
| -------- | ------------------ | -------------------------------- |
| 1️⃣       | **CLI flag**       | `herdux --engine mysql list`     |
| 2️⃣       | **Server profile** | Profile's `engine` field         |
| 3️⃣       | **Saved default**  | `herdux config set engine mysql` |
| 4️⃣       | **Fallback**       | `postgres`                       |

### Connection Priority

| Priority | Source             | Example                                       |
| -------- | ------------------ | --------------------------------------------- |
| 1️⃣       | **CLI flags**      | `herdux list --port 5417`                     |
| 2️⃣       | **Server profile** | `herdux list -s pg16`                         |
| 3️⃣       | **Saved defaults** | `herdux config set port 5432`                 |
| 4️⃣       | **Auto-discovery** | Scans common ports; prompts if multiple found |

This means explicit input always wins. No surprises.

---

## 🤔 Why not pgAdmin / phpMyAdmin?

**Herdux** is not a GUI replacement.
It's a workflow accelerator for developers who live in the terminal.

No GUI. No overhead. Just speed.

---

## 🧠 Design Principles

- No hidden defaults.
- No destructive magic.
- Deterministic connection and engine resolution.
- Explicit and composable commands.
- Engine-agnostic: same interface, any database.

---

## 🐳 Docker Support

> Docker MUST NOT be required for normal CLI usage.
> Docker is currently used internally for end-to-end testing to validate real database workflows.
> Runtime Docker integration (detecting and managing live containers) is planned.

---

## 🗺 Roadmap

See [ROADMAP.md](./ROADMAP.md) for our detailed future plans, including Docker integration and encrypted backups.

---

## 🤝 Contributing

PRs are welcome! Please open an issue first to discuss major changes.

```bash
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli
npm install
npm run dev

# Run the unit test suite
npm run test:unit
# Run the E2E test suites (requires Docker)
npm run test:e2e:pgsql
npm run test:e2e:mysql
```

> Herdux follows strict architectural boundaries.
> Commands are engine-agnostic, engines encapsulate all database-specific behavior, and all binaries are isolated behind adapters.
> Please keep these boundaries intact when contributing.

---

## ☕ Support the Project

If **Herdux** has saved you hours of debugging and database wrangling, consider supporting the project! It helps keep it active and open-source.

<a href="https://github.com/sponsors/eduardozaniboni" target="_blank"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github" alt="GitHub Sponsors"></a>
<a href="https://www.buymeacoffee.com/eduardozaniboni" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 28px !important;width: 100px !important;" ></a>

---

## 📄 License

MIT
