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

const program = new Command();

program
  .name("herdux")
  .description("🐘 A modern CLI to PostgreSQL management")
  .version("0.1.0")
  .option("-H, --host <host>", "PostgreSQL host")
  .option("-p, --port <port>", "PostgreSQL port (auto-detected if omitted)")
  .option("-U, --user <user>", "PostgreSQL user")
  .option("-W, --password <password>", "PostgreSQL password")
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
