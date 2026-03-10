# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.9.1] - 2026-03-10

### Fixed

- `restore` (PostgreSQL plain, MySQL): SQL files produced by `pg_dump -C`, pgAdmin, or `mysqldump --databases` embed `\connect`, `CREATE DATABASE`, and `USE` directives that redirected the client to the source database, ignoring `--db`. The plain SQL content is now filtered to strip these directives before being piped to the database client, so the restore always targets the database specified via `--db`.

---

## [0.9.0] - 2026-03-04

### Added

- MongoDB engine support (`--engine mongodb`). Requires `mongosh`, `mongodump`, and `mongorestore` binaries.
- Backup format: archive (`mongodump --archive --gzip`) producing `.mongodump` files. Plain format is not supported by MongoDB and will exit with a clear error.
- `hdx inspect <file>.mongodump`: inspect MongoDB archive dumps offline via `mongorestore --dryRun`.
- MongoDB added to `hdx cloud upload` and `hdx restore s3://` workflows (engine-agnostic path, no changes required).
- `mongodb` added to npm keywords.

---

## [0.8.2] - 2026-03-04

### Added

- `hdx cloud list [path]` now defaults to directory mode: shows only immediate children (files and subdirectories) at the given level, similar to `ls`. Pass `--recursive` to list all objects regardless of depth.
- `hdx cloud upload <file> [--prefix PREFIX]` command: upload an existing local file to the configured S3 bucket.
- `hdx backup --no-keep` flag: delete the local backup file after a successful upload (requires `--upload`).
- `hdx cloud delete` now verifies the key exists before attempting deletion. Exits with an error if the key is not found or is a directory prefix.

### Fixed

- `hdx cloud list <path>` now accepts path as a positional argument. Previously, passing a path without `--prefix` was silently ignored.
- `hdx cloud download` now saves files to `~/.herdux/backups/` by default, creating the directory if needed. Previously, files were saved to the current working directory.

---

## [0.8.1] - 2026-03-03

### Fixed

- `hdx cloud list` no longer crashes with a stack overflow when the bucket contains a very large number of objects. Display is now capped at 200 items with a truncation notice.

---

## [0.8.0] - 2026-03-03

### Added

- `hdx cloud config` command: configure cloud storage settings (bucket, region, access-key, secret-key, endpoint). Credentials stored in `~/.herdux/config.json`; env vars `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` take priority.
- `hdx cloud list [--prefix PREFIX]` command: list backup files in the configured S3 bucket. Displays key, size, and last modified date in a table.
- `hdx cloud download <key> [-o DIR]` command: download a backup file from the configured S3 bucket to a local directory.
- `hdx cloud delete <key> [-y]` command: delete a backup file from the configured S3 bucket. Requires confirmation unless `--yes` is passed.
- `hdx backup --upload [prefix]` flag: after a successful backup, upload the file to the configured S3 bucket. Accepts an optional key prefix (e.g. `backups/`).
- `hdx restore s3://bucket/key --db mydb`: restore directly from an S3 URL. Downloads to a temp file, restores, then cleans up automatically.
- Support for any S3-compatible provider (Cloudflare R2, MinIO, DigitalOcean Spaces) via `hdx cloud config endpoint URL`.

---

## [0.7.0] - 2026-03-02

### Added

- `hdx docker list` command: lists running postgres, mysql, and mariadb containers. Displays name, engine type, mapped host port, and status in a table. Accepts `--all` to include stopped containers.
- `hdx docker start <name>` command: starts a stopped database container.
- `hdx docker stop <name>` command: stops a running container. Accepts `--remove` to also remove it after stopping.

---

## [0.6.0] - 2026-03-02

### Added

- `hdx inspect <file>` command: inspects the contents of a backup file without connecting to a database. Supports `.dump` (PostgreSQL custom, via `pg_restore --list`), `.sql` (any engine, extracts CREATE statements), and `.db` / `.sqlite` (SQLite, via `sqlite3 .schema`). Completely offline.

### Fixed

- MySQL engine now rejects `--format custom` with a clear error message. Previously, passing `--format custom` for a MySQL backup was silently ignored and produced a plain SQL file regardless. MySQL only supports plain SQL format via `mysqldump`.

---

## [0.5.0] - 2026-03-02

### Added

- SQLite engine support (`--engine sqlite`). File-based, no server required. Databases stored at `~/.herdux/sqlite/` by default; override with `--host <dir>`.
- `test:e2e:sqlite` npm script and `e2e-sqlite` CI job. No Docker required; SQLite is installed via `apt-get` in CI.
- SQLite E2E workflow test covering the full lifecycle: doctor, version, config, create, list, backup (custom and plain), drop, restore, cleanup.
- `sqlite` added to npm keywords.

### Fixed

- Connection resolver now skips port-based auto-discovery for portless engines. Previously, running any command with `--engine sqlite` without a port would incorrectly trigger server scanning and exit with "No running SQLite servers found".
- `sqlite` added to the valid engines list in `src/index.ts`. Previously, passing `--engine sqlite` was rejected with "Unknown engine".

---

## [0.4.3] - 2026-03-01

### Added

- Help examples via `.addHelpText` for all 9 commands, visible with `hdx <command> --help`.
- Input validation for database names: rejects names containing spaces and special shell characters.
- Improved command descriptions for clarity across all commands.

---

## [0.4.2] - 2026-02-28

### Added

- CLI integration test harness (`CliRunner`) with isolated temp directories. Tests run the compiled CLI as a subprocess.
- AI agent workflow guides in `.agents/workflows/`: `pre-commit.md`, `testing.md`, `new-engine.md`, `new-command.md`, `refactoring.md`.
- Coverage thresholds enforced in CI: 95% statements, functions, lines, and branches for `src/commands/`.

### Changed

- All unit tests parametrized with `describe.each(engines)` to run against both PostgreSQL and MySQL simultaneously.
- Extracted `promptServerSelection` and `resolveEngineType` from `resolve-connection.ts` into private helpers, reducing function size and improving testability.

---

## [0.4.1] - 2026-02-28

### Fixed

- `--engine` flag now correctly filters the server profile selection prompt. Previously, passing `--engine mysql` would still show PostgreSQL profiles in the interactive list.

---

## [0.4.0] - 2026-02-27

### Added

- MySQL engine support (`--engine mysql`). Requires `mysql` and `mysqldump` binaries.
- Multi-engine architecture: all commands are now engine-agnostic behind the `IDatabaseEngine` interface.
- `--engine` global flag accepted by all commands.
- Engine type saved per server profile and in global config (`herdux config set engine mysql`).
- GitHub Actions CI, Dependabot config, and Husky pre-commit hooks.

---

## [0.3.1] - 2026-02-26

### Fixed

- PostgreSQL restore now ignores ownership and ACL assignments (`--no-owner`, `--no-acl`), preventing errors when restoring production dumps to a local environment where production roles do not exist.
- Non-fatal `pg_restore` warnings (e.g. missing roles) are now reported informatively instead of causing the command to fail.

---

## [0.3.0] - 2026-02-26

### Changed

- Full architecture refactor: decoupled all CLI commands from PostgreSQL internals and introduced the abstract `IDatabaseEngine` contract (`src/core/interfaces/`).
- Engine implementations moved to `src/infra/engines/`, commands moved to `src/commands/`.
- Added comprehensive E2E test suite using Docker Compose.
- Added comprehensive unit test suite with Jest and `ts-jest`.

---

## [0.2.2] - 2026-02-25

### Changed

- Minor documentation and badge updates.

---

## [0.2.0] - 2026-02-25

### Added

- `hdx` short alias for the `herdux` binary.
- CLI version now reads dynamically from `package.json` at runtime.

---

## [0.1.1] - 2026-02-24

### Changed

- Renamed application to `herdux` (from previous internal name).
- Published as `herdux-cli` on npm.

---

## [0.1.0] - 2026-02-23

### Added

- Initial release. PostgreSQL-only CLI.
- Commands: `version`, `list`, `create`, `drop`, `backup`, `restore`, `clean`, `doctor`, `config`.
- Named server profiles with `herdux config add`.
- Global defaults with `herdux config set`.
- Auto-discovery of running PostgreSQL servers on common ports.
- Backup in `custom` (pg_dump `-Fc`) and `plain` (SQL) formats.
- Restore with automatic format detection and database auto-creation.
- Interactive multi-select bulk cleanup (`herdux clean`) with optional safety backup.
