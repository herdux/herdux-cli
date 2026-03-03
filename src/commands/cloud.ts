import { basename, join, resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  getCloudConfig,
  setCloudConfig,
  resetCloudConfig,
} from "../infra/config/config.service.js";
import type { CloudConfig } from "../infra/config/config.service.js";
import { resolveCloudCredentials } from "../infra/cloud/cloud-credential.js";
import {
  uploadFile,
  downloadFile,
  listObjects,
  listDirectory,
  deleteObject,
} from "../infra/cloud/s3.service.js";

const CLOUD_CONFIG_KEYS = [
  "bucket",
  "region",
  "endpoint",
  "access-key",
  "secret-key",
] as const;

type CloudConfigKey = (typeof CLOUD_CONFIG_KEYS)[number];

const SECRET_KEYS: CloudConfigKey[] = ["access-key", "secret-key"];
const PLAINTEXT_WARNING =
  "Stored in plaintext in ~/.herdux/config.json. For CI/production, prefer env vars: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY";

function keyToConfigField(key: CloudConfigKey): keyof CloudConfig {
  if (key === "access-key") return "access_key_id";
  if (key === "secret-key") return "secret_access_key";
  return key as keyof CloudConfig;
}

function redact(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 2) + "*".repeat(value.length - 2);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function registerCloudCommand(program: Command): void {
  const cloudCmd = program
    .command("cloud")
    .helpCommand(false)
    .description("Manage cloud storage for backups (AWS S3 and S3-compatible)")
    .addHelpText(
      "after",
      `
Examples:
  hdx cloud config bucket my-bucket
  hdx cloud config region us-east-1
  hdx cloud config access-key AKIAIO...
  hdx cloud config secret-key wJalrX...
  hdx cloud list
  hdx cloud list tributario/
  hdx cloud list "tributario/Pasta Clientes Migração/Clientes/ES/"
  hdx cloud upload /tmp/mydb.dump
  hdx cloud upload /tmp/mydb.dump --prefix backups/mydb/
  hdx cloud download backups/mydb_2026-03-03.dump
  hdx cloud delete backups/mydb_2026-03-03.dump`,
    );

  // hdx cloud config [key] [value]
  cloudCmd
    .command("config [key] [value]")
    .description("Configure cloud storage settings")
    .option("-r, --reset", "Clear all cloud configuration")
    .addHelpText(
      "after",
      `
Keys:
  bucket      S3 bucket name
  region      AWS region (default: us-east-1)
  access-key  AWS access key ID
  secret-key  AWS secret access key
  endpoint    Custom endpoint URL (for Cloudflare R2, MinIO, etc.)

Examples:
  hdx cloud config                          Show current configuration
  hdx cloud config bucket my-bucket
  hdx cloud config region us-east-1
  hdx cloud config access-key AKIAIO...
  hdx cloud config secret-key wJalrX...
  hdx cloud config --reset`,
    )
    .action(
      async (key?: string, value?: string, opts?: { reset?: boolean }) => {
        try {
          if (opts?.reset) {
            resetCloudConfig();
            console.log(chalk.green("\n✔ Cloud configuration cleared\n"));
            return;
          }

          if (!key) {
            const cloud = getCloudConfig();
            const lines: string[] = ["\n  Cloud storage configuration:\n"];
            const show = (label: string, val?: string, secret = false) => {
              const display = val
                ? secret
                  ? chalk.cyan(redact(val))
                  : chalk.cyan(val)
                : chalk.gray("(not set)");
              lines.push(`  ${label.padEnd(14)}${display}`);
            };
            show("bucket", cloud.bucket);
            show("region", cloud.region || "us-east-1 (default)");
            show("access-key", cloud.access_key_id, true);
            show("secret-key", cloud.secret_access_key, true);
            show("endpoint", cloud.endpoint);
            console.log(lines.join("\n") + "\n");
            return;
          }

          if (!CLOUD_CONFIG_KEYS.includes(key as CloudConfigKey)) {
            console.error(
              chalk.red(
                `\n✖ Unknown key "${key}". Valid keys: ${CLOUD_CONFIG_KEYS.join(", ")}\n`,
              ),
            );
            process.exit(1);
          }

          if (!value) {
            console.error(chalk.red(`\n✖ Value required for "${key}"\n`));
            process.exit(1);
          }

          const field = keyToConfigField(key as CloudConfigKey);
          setCloudConfig(field, value);

          if (SECRET_KEYS.includes(key as CloudConfigKey)) {
            console.log(chalk.green(`\n✔ ${key} saved`));
            console.log(chalk.yellow(`  ⚠ ${PLAINTEXT_WARNING}\n`));
          } else {
            console.log(
              chalk.green(`\n✔ ${key} set to ${chalk.cyan(value)}\n`),
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✖ ${message}\n`));
          process.exit(1);
        }
      },
    );

  // hdx cloud list [path] [-R]
  cloudCmd
    .command("list [path]")
    .alias("ls")
    .description("List objects in the configured S3 bucket")
    .option("-R, --recursive", "List all objects recursively")
    .action(async (path: string | undefined, opts: { recursive?: boolean }) => {
      try {
        const cloud = getCloudConfig();
        if (!cloud.bucket) {
          console.error(
            chalk.red(
              "\n✖ Bucket not configured. Run: hdx cloud config bucket NAME\n",
            ),
          );
          process.exit(1);
        }
        const creds = resolveCloudCredentials(cloud);
        const prefix = path ?? "";
        const spinner = ora("Fetching objects from S3...").start();

        if (opts.recursive) {
          const objects = await listObjects(cloud.bucket, prefix, creds);

          if (objects.length === 0) {
            spinner.warn(
              prefix
                ? `No objects found with prefix "${prefix}"`
                : "No objects found in bucket",
            );
            console.log();
            return;
          }

          const MAX_DISPLAY = 200;
          const truncated = objects.length > MAX_DISPLAY;
          const display = truncated ? objects.slice(0, MAX_DISPLAY) : objects;

          spinner.succeed(
            `Found ${objects.length} object(s) in ${chalk.cyan(`s3://${cloud.bucket}/${prefix}`)}\n`,
          );

          const relKeys = display.map((o) => o.key.slice(prefix.length));
          const keyWidth =
            relKeys.reduce((max, k) => Math.max(max, k.length), 20) + 2;
          const sizeWidth = 12;

          console.log(
            chalk.bold(
              `  ${"KEY".padEnd(keyWidth)}${"SIZE".padEnd(sizeWidth)}MODIFIED`,
            ),
          );
          console.log(chalk.gray(`  ${"─".repeat(keyWidth + sizeWidth + 20)}`));

          for (let i = 0; i < display.length; i++) {
            const obj = display[i];
            console.log(
              `  ${chalk.cyan(relKeys[i].padEnd(keyWidth))}${formatSize(obj.size).padEnd(sizeWidth)}${chalk.gray(formatDate(obj.lastModified))}`,
            );
          }

          if (truncated) {
            console.log(
              chalk.yellow(
                `\n  ... and ${objects.length - MAX_DISPLAY} more objects not shown. Use --prefix to narrow results.\n`,
              ),
            );
          } else {
            console.log();
          }
        } else {
          const { files, dirs } = await listDirectory(
            cloud.bucket,
            prefix,
            creds,
          );

          if (files.length === 0 && dirs.length === 0) {
            spinner.warn(
              prefix
                ? `No objects found with prefix "${prefix}"`
                : "No objects found in bucket",
            );
            console.log();
            return;
          }

          spinner.succeed(
            `Found ${dirs.length + files.length} item(s) in ${chalk.cyan(`s3://${cloud.bucket}/${prefix}`)}\n`,
          );

          const allNames = [
            ...dirs.map((d) => d.slice(prefix.length)),
            ...files.map((f) => f.key.slice(prefix.length)),
          ];
          const keyWidth =
            allNames.reduce((max, n) => Math.max(max, n.length), 20) + 2;
          const sizeWidth = 12;

          console.log(
            chalk.bold(
              `  ${"NAME".padEnd(keyWidth)}${"SIZE".padEnd(sizeWidth)}MODIFIED`,
            ),
          );
          console.log(chalk.gray(`  ${"─".repeat(keyWidth + sizeWidth + 20)}`));

          for (const dir of dirs) {
            const name = dir.slice(prefix.length);
            console.log(
              `  ${chalk.cyan(name.padEnd(keyWidth))}${chalk.gray("[dir]")}`,
            );
          }

          for (const obj of files) {
            const name = obj.key.slice(prefix.length);
            console.log(
              `  ${chalk.cyan(name.padEnd(keyWidth))}${formatSize(obj.size).padEnd(sizeWidth)}${chalk.gray(formatDate(obj.lastModified))}`,
            );
          }

          console.log();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });

  // hdx cloud upload <file> [--prefix PREFIX]
  cloudCmd
    .command("upload <file>")
    .description("Upload a local file to the configured S3 bucket")
    .option("-p, --prefix <prefix>", "Destination folder in the bucket")
    .action(async (file: string, opts: { prefix?: string }) => {
      try {
        const cloud = getCloudConfig();
        if (!cloud.bucket) {
          console.error(
            chalk.red(
              "\n✖ Bucket not configured. Run: hdx cloud config bucket NAME\n",
            ),
          );
          process.exit(1);
        }
        if (!existsSync(file)) {
          console.error(chalk.red(`\n✖ File not found: ${file}\n`));
          process.exit(1);
        }
        const creds = resolveCloudCredentials(cloud);
        const key = opts.prefix
          ? `${opts.prefix.replace(/\/$/, "")}/${basename(file)}`
          : basename(file);

        const spinner = ora(
          `Uploading to s3://${cloud.bucket}/${key}...`,
        ).start();
        const s3Url = await uploadFile(file, cloud.bucket, key, creds);
        spinner.succeed(`Uploaded: ${chalk.cyan(s3Url)}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });

  // hdx cloud download <key> [-o DIR]
  cloudCmd
    .command("download <key>")
    .description("Download a backup file from the configured S3 bucket")
    .option(
      "-o, --output <dir>",
      "Destination directory (default: ~/.herdux/backups)",
    )
    .action(async (key: string, opts: { output?: string }) => {
      try {
        const cloud = getCloudConfig();
        if (!cloud.bucket) {
          console.error(
            chalk.red(
              "\n✖ Bucket not configured. Run: hdx cloud config bucket NAME\n",
            ),
          );
          process.exit(1);
        }
        const creds = resolveCloudCredentials(cloud);

        const destDir = resolve(
          opts.output ?? join(homedir(), ".herdux", "backups"),
        );
        mkdirSync(destDir, { recursive: true });
        const destPath = join(destDir, basename(key));

        if (existsSync(destPath)) {
          console.error(chalk.red(`\n✖ File already exists: ${destPath}\n`));
          process.exit(1);
        }

        const spinner = ora(
          `Downloading s3://${cloud.bucket}/${key}...`,
        ).start();
        await downloadFile(cloud.bucket, key, destPath, creds);
        spinner.succeed(`Downloaded: ${chalk.cyan(destPath)}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });

  // hdx cloud delete <key> [-y]
  cloudCmd
    .command("delete <key>")
    .description("Delete a backup file from the configured S3 bucket")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (key: string, opts: { yes?: boolean }) => {
      try {
        const cloud = getCloudConfig();
        if (!cloud.bucket) {
          console.error(
            chalk.red(
              "\n✖ Bucket not configured. Run: hdx cloud config bucket NAME\n",
            ),
          );
          process.exit(1);
        }
        const creds = resolveCloudCredentials(cloud);

        if (!opts.yes) {
          const { confirmed } = await prompts({
            type: "confirm",
            name: "confirmed",
            message: `Delete s3://${cloud.bucket}/${key}?`,
            initial: false,
          });
          if (!confirmed) {
            console.log(chalk.gray("\n  Cancelled\n"));
            return;
          }
        }

        const spinner = ora(`Deleting s3://${cloud.bucket}/${key}...`).start();
        await deleteObject(cloud.bucket, key, creds);
        spinner.succeed(
          `Deleted: s3://${chalk.cyan(cloud.bucket)}/${chalk.cyan(key)}\n`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n✖ ${message}\n`));
        process.exit(1);
      }
    });
}
