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
  .helpCommand(false)
  .description("A modern CLI to Database management")
  .version("0.1.2")
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
