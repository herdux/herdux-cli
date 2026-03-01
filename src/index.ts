#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { registerVersionCommand } from "./commands/version.js";
import { registerListCommand } from "./commands/list.js";
import { registerCreateCommand } from "./commands/create.js";
import { registerDropCommand } from "./commands/drop.js";
import { registerBackupCommand } from "./commands/backup.js";
import { registerRestoreCommand } from "./commands/restore.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerCleanCommand } from "./commands/clean.js";
import { registerDoctorCommand } from "./commands/doctor.js";

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const program = new Command();

program
  .name("herdux")
  .helpCommand(false)
  .description("A modern CLI for PostgreSQL and MySQL database management")
  .version(pkg.version)
  .option("-H, --host <host>", "Database host")
  .option("-p, --port <port>", "Database port (auto-detected if omitted)")
  .option("-U, --user <user>", "Database user")
  .option("-W, --password <password>", "Database password")
  .option("-s, --server <name>", "Use a named server profile from config")
  .option("-e, --engine <type>", "Database engine (postgres, mysql)")
  .addHelpText(
    "after",
    `
Examples:
  hdx list
  hdx backup mydb --output /tmp/backups
  hdx restore backup.dump --db mydb
  hdx --engine mysql list
  hdx --host 192.168.1.1 --user admin backup mydb

Run 'hdx <command> --help' for command-specific examples and options.`,
  );

program.hook("preAction", () => {
  const opts = program.opts();

  if (opts.port !== undefined) {
    const portNum = Number(opts.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      console.error(
        chalk.red(
          `\n✖ Invalid port "${opts.port}". Must be a number between 1 and 65535.\n`,
        ),
      );
      process.exit(1);
    }
  }

  const validEngines = ["postgres", "mysql"];
  if (opts.engine !== undefined && !validEngines.includes(opts.engine)) {
    console.error(
      chalk.red(
        `\n✖ Unknown engine "${opts.engine}". Valid engines: ${validEngines.join(", ")}.\n`,
      ),
    );
    process.exit(1);
  }
});

registerVersionCommand(program);
registerListCommand(program);
registerCreateCommand(program);
registerDropCommand(program);
registerBackupCommand(program);
registerRestoreCommand(program);
registerConfigCommand(program);
registerCleanCommand(program);
registerDoctorCommand(program);

program.parse();
