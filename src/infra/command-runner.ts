import { execa, type Options as ExecaOptions } from "execa";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  /** Path to a file whose contents will be piped into stdin */
  stdin?: string;
}

export async function runCommand(
  command: string,
  args: string[] = [],
  options: RunOptions = {},
): Promise<RunResult> {
  const execaOptions: ExecaOptions = {
    reject: false,
    timeout: options.timeout ?? 30_000,
    ...(options.cwd && { cwd: options.cwd }),
    ...(options.env && { env: { ...process.env, ...options.env } }),
    ...(options.stdin && { inputFile: options.stdin }),
  };
  const result = await execa(command, args, execaOptions);

  let stderr = result.stderr?.toString() ?? "";
  if (!stderr && (result.failed || result.exitCode !== 0)) {
    stderr = result.shortMessage ?? result.message ?? "Unknown execa error";
  }

  return {
    stdout: result.stdout?.toString() ?? "",
    stderr,
    exitCode: result.exitCode ?? (result.failed ? 1 : 0),
  };
}
