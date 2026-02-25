#!/usr/bin/env node

import { Command } from "commander";
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
  .description("A modern CLI to Database management")
  .version(pkg.version)
  .option("-H, --host <host>", "Database host")
  .option("-p, --port <port>", "Database port (auto-detected if omitted)")
  .option("-U, --user <user>", "Database user")
  .option("-W, --password <password>", "Database password")
  .option("-s, --server <name>", "Use a named server profile from config");

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
