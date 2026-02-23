import { runCommand } from "../core/command-runner.js";
import { platform } from "os";

export async function binaryExists(name: string): Promise<boolean> {
  const cmd = platform() === "win32" ? "where" : "which";
  const result = await runCommand(cmd, [name]);
  return result.exitCode === 0;
}

export async function getBinaryVersion(name: string): Promise<string | null> {
  const result = await runCommand(name, ["--version"]);

  if (result.exitCode !== 0) {
    return null;
  }

  const output = result.stdout.trim().split("\n")[0];
  return output || null;
}
