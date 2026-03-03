import { runCommand } from "../command-runner.js";
import { binaryExists } from "../utils/detect-binary.js";

export interface DatabaseContainer {
  id: string;
  name: string;
  image: string;
  hostPort: string;
  containerPort: string;
  status: string;
  engineType: "postgres" | "mysql" | "unknown";
}

const IMAGE_ENGINE_MAP: Record<
  string,
  { engineType: "postgres" | "mysql"; containerPort: string }
> = {
  postgres: { engineType: "postgres", containerPort: "5432" },
  mysql: { engineType: "mysql", containerPort: "3306" },
  mariadb: { engineType: "mysql", containerPort: "3306" },
};

function detectEngine(image: string): {
  engineType: "postgres" | "mysql" | "unknown";
  containerPort: string;
} {
  const lower = image.toLowerCase();
  for (const [key, value] of Object.entries(IMAGE_ENGINE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return { engineType: "unknown", containerPort: "" };
}

function parseHostPort(portsStr: string): string {
  // Matches patterns like: 0.0.0.0:5432->5432/tcp or :::3306->3306/tcp
  const match = portsStr.match(/:(\d+)->\d+\/tcp/);
  return match ? match[1] : "";
}

export async function isDockerAvailable(): Promise<boolean> {
  const hasBinary = await binaryExists("docker");
  if (!hasBinary) return false;
  const result = await runCommand(
    "docker",
    ["info", "--format", "{{.ServerVersion}}"],
    { timeout: 5_000 },
  );
  return result.exitCode === 0;
}

export async function listDatabaseContainers(
  showAll = false,
): Promise<DatabaseContainer[]> {
  const args = [
    "ps",
    "--format",
    "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}",
  ];
  if (showAll) args.push("--all");

  const result = await runCommand("docker", args);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "docker ps failed");
  }

  const containers: DatabaseContainer[] = [];

  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;

    const parts = line.split("\t");
    const id = parts[0] ?? "";
    const name = parts[1] ?? "";
    const image = parts[2] ?? "";
    const ports = parts[3] ?? "";
    const status = parts.slice(4).join("\t");

    const { engineType, containerPort } = detectEngine(image);
    if (engineType === "unknown") continue;

    containers.push({
      id,
      name,
      image,
      hostPort: parseHostPort(ports),
      containerPort,
      status,
      engineType,
    });
  }

  return containers;
}

export async function startContainer(name: string): Promise<void> {
  const result = await runCommand("docker", ["start", name]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to start container "${name}"`);
  }
}

export async function stopContainer(
  name: string,
  remove = false,
): Promise<void> {
  const stopResult = await runCommand("docker", ["stop", name]);
  if (stopResult.exitCode !== 0) {
    throw new Error(stopResult.stderr || `Failed to stop container "${name}"`);
  }

  if (remove) {
    const rmResult = await runCommand("docker", ["rm", name]);
    if (rmResult.exitCode !== 0) {
      throw new Error(
        rmResult.stderr || `Failed to remove container "${name}"`,
      );
    }
  }
}
