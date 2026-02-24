🇺🇸 English | 🇧🇷 [Português](./README.pt-BR.md)

# 🐘 herdux — PostgreSQL Manager CLI

A modern, fast, and interactive CLI designed to eliminate Developer Experience (DX) friction when managing local PostgreSQL databases, especially in environments with massive datasets, multiple server instances, and heavy daily operations.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)

> Designed primarily for local and development environments.

<p align="center">
  <img src=".github/demo.png" alt="herdux terminal demo" width="720" />
</p>

---

## ⚡ Quick Start

```bash
npm install -g herdux
herdux doctor
herdux list
```

That's it. You're managing databases.

---

## Why herdux?

Managing PostgreSQL through raw commands is repetitive, error-prone, and painful at scale.

### ❌ Without herdux

```bash
# Backup a database
pg_dump -U postgres -h localhost -p 5416 -Fc -f ./backups/mydb_2026-02-23.dump mydb

# Then manually drop it
psql -U postgres -h localhost -p 5416 -c "DROP DATABASE mydb;"

# Restore from backup
pg_restore -U postgres -h localhost -p 5416 -d mydb --clean --if-exists ./backups/mydb_2026-02-23.dump

# Check if tools are installed
psql --version && pg_dump --version && pg_restore --version
```

### ✅ With herdux

```bash
herdux backup mydb --drop --yes        # Backup + drop in one shot
herdux restore ./backups/mydb.dump --db mydb   # Auto-detects format
herdux clean                            # Multi-select and batch-drop databases
herdux doctor                           # Full system health check
```

One command. Fewer flags. Fewer mistakes.

---

## 💡 Philosophy

**Herdux** combines *herd* and *UX* — delivering a better developer experience when managing your PostgreSQL database clusters. The name reflects our focus on improving the developer experience of managing database herds.

herdux follows three principles:

- **Safety first** — Never drops data without explicit confirmation or a verified backup.
- **Explicit over implicit** — Connection resolution follows a strict, documented priority. No magic.
- **Developer workflow optimization** — Every command is designed to save you from repetitive terminal work.

---

## 🔒 Safety

`herdux` handles destructive operations with care:

- **Never drops a database** unless explicit confirmation is given
- **Aborts the entire operation** if a safety backup fails during `herdux clean`
- **Validates `pg_dump` exit codes** before considering a backup successful
- **Requires `--drop` flag** intentionally — dropping is never the default
- **`--yes` must be combined with `--drop`** — cannot skip confirmation alone

> If you request a backup before dropping and that backup fails, herdux stops immediately. No data is lost.

---

## 🚀 Key Features

- **📋 Smart Listing** — Optimized listing strategy for massive clusters. Optional `--size` flag for disk usage analysis, sorted largest-first.
- **💾 Intelligent Backup & Restore** — Supports Custom (`.dump`) and Plain (`.sql`) formats. Auto-detects the right tool for restores.
- **🧹 Bulk Cleanup** — Multi-select databases, optionally backup, and batch-drop them. Reclaim disk space instantly.
- **🩺 System Diagnostics** — One-command health check verifying binaries, authentication, and connectivity.
- **⚙️ Persistent Profiles** — Save named server configurations. Switch between environments with `-s pg16`.
- **🎯 Smart Connection Resolution** — Explicit CLI flags → profiles → saved defaults → auto-discovery. Always predictable.

---

## 🧩 Requirements

- **Node.js** 18 or higher
- **PostgreSQL client tools** (`psql`, `pg_dump`, `pg_restore`) installed and available in your `PATH`

> [!TIP]
> Run `herdux doctor` after installation to verify everything is set up correctly.

---

## 📦 Installation

**npm (recommended):**

```bash
npm install -g herdux
```

**From source:**

```bash
git clone https://github.com/your-user/cli-herdux.git
cd cli-herdux
npm install
npm run build
npm link
```

---

## 🛠️ Commands

### `herdux version`

Shows the CLI version and the connected PostgreSQL server version.

```bash
herdux version
```

### `herdux doctor`

Runs a full system health check:

- Verifies `psql`, `pg_dump`, and `pg_restore` are installed and reachable
- Attempts a live connection using the resolved configuration
- Tests authentication against the target server

```bash
herdux doctor
```

---

### 📋 `herdux list`

Lists all databases on the connected server.

```bash
herdux list              # Fast listing (name, owner, encoding)
herdux ls --size         # Includes disk size, sorted largest → smallest
```

> [!NOTE]
> The `--size` flag calculates physical disk usage via `pg_database_size()`. On servers with dozens of multi-GB databases, this may take a few minutes depending on disk speed.

---

### `herdux create <name>`

Creates a new database.

```bash
herdux create my_new_db
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
herdux backup mydb                       # Custom format (.dump)
herdux backup mydb --format plain        # Plain SQL (.sql)
herdux backup mydb --drop                # Backup, then ask to drop
herdux backup mydb --drop --yes          # Backup + drop, no questions
herdux backup mydb -o ./my-backups       # Custom output directory
```

| Option | Description |
|---|---|
| `-F, --format <type>` | `custom` (default, compressed) or `plain` (raw SQL) |
| `-d, --drop` | Prompt to drop database after successful backup |
| `-y, --yes` | Skip drop confirmation (requires `--drop`) |
| `-o, --output <dir>` | Output directory (default: `./backups`) |

---

### 📥 `herdux restore <file>`

Restores a database from a backup file. Automatically detects the format:

- `.sql` → uses `psql -f`
- `.dump` or any other extension → uses `pg_restore`

```bash
herdux restore ./backups/mydb_2026-02-23.dump --db mydb
herdux restore ./exports/data.sql --db mydb
```

Need to override auto-detection? Use `--format`:

```bash
herdux restore archive.bkp --db mydb --format custom
herdux restore script.txt --db mydb --format plain
```

---

## ⚙️ Configuration & Server Profiles

`herdux` stores configuration locally at `~/.herdux/config.json`.

### Set Global Defaults

```bash
herdux config set user postgres
herdux config set password my_secret
herdux config set port 5432
```

### Named Server Profiles

Manage multiple PostgreSQL instances effortlessly:

```bash
herdux config add pg16 --port 5416
herdux config add pg17 --port 5417 --user admin
herdux config add staging --host 192.168.0.10 --port 5432
```

Then connect using the `-s` flag:

```bash
herdux list -s pg16
herdux backup mydb -s staging
```

### View & Manage Config

```bash
herdux config list           # Show all saved settings and profiles
herdux config get port       # Get a specific value
herdux config rm pg16        # Remove a server profile
herdux config reset          # Clear all configuration
```

---

## 🔌 Connection Priority

When resolving how to connect, `herdux` follows a strict, predictable priority order:

| Priority | Source | Example |
|---|---|---|
| 1️⃣ | **CLI flags** | `herdux list --port 5417` |
| 2️⃣ | **Server profile** | `herdux list -s pg16` |
| 3️⃣ | **Saved defaults** | `herdux config set port 5432` |
| 4️⃣ | **Auto-discovery** | Scans common ports; prompts if multiple found |

This means explicit input always wins. No surprises.

---

## 🤔 Why not pgAdmin?

pgAdmin is a powerful GUI tool for database administration. `herdux` is not a replacement for it.

`herdux` is optimized for **terminal-first developer workflows** — quick operations, scripting, CI pipelines, and managing multiple local instances without leaving the terminal.

No GUI. No overhead. Just speed.

---

## 🐳 Docker Support (Coming Soon)

`herdux` will be able to detect and interact with PostgreSQL instances running inside Docker containers — listing, connecting, and managing them as naturally as local instances.

---

## 🗺 Roadmap

- [x] Backup & restore
- [x] Profiles
- [x] Doctor
- [ ] Docker integration
- [ ] Encrypted backups
- [ ] TTL cleanup
- [ ] Windows binary build

---

## 🤝 Contributing

PRs are welcome! Please open an issue first to discuss major changes.

```bash
git clone https://github.com/your-user/cli-herdux.git
cd cli-herdux
npm install
npm run dev
```

---

## 📄 License

MIT
