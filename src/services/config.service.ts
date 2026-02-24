import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ConnectionOptions } from "./postgres.service.js";

const CONFIG_DIR = join(homedir(), ".herdux");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface ServerProfile extends ConnectionOptions {
  name?: string;
}

export interface HerduxConfig {
  default: ConnectionOptions;
  servers: Record<string, ConnectionOptions>;
  scan_ports: string[];
}

function getEmptyConfig(): HerduxConfig {
  return {
    default: {},
    servers: {},
    scan_ports: [],
  };
}

export function loadConfig(): HerduxConfig {
  if (!existsSync(CONFIG_FILE)) {
    return getEmptyConfig();
  }

  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      default: parsed.default ?? {},
      servers: parsed.servers ?? {},
      scan_ports: parsed.scan_ports ?? [],
    };
  } catch {
    return getEmptyConfig();
  }
}

export function saveConfig(config: HerduxConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getDefault(): ConnectionOptions {
  const config = loadConfig();
  return config.default;
}

export function getServer(name: string): ConnectionOptions | null {
  const config = loadConfig();
  return config.servers[name] ?? null;
}

export function setDefault(key: string, value: string): void {
  const config = loadConfig();
  (config.default as Record<string, string>)[key] = value;
  saveConfig(config);
}

export function addServer(name: string, opts: ConnectionOptions): void {
  const config = loadConfig();
  config.servers[name] = { ...config.servers[name], ...opts };
  saveConfig(config);
}

export function removeServer(name: string): boolean {
  const config = loadConfig();
  if (!config.servers[name]) return false;
  delete config.servers[name];
  saveConfig(config);
  return true;
}

export function listServers(): Record<string, ConnectionOptions> {
  const config = loadConfig();
  return config.servers;
}

export function getScanPorts(): string[] {
  const config = loadConfig();
  return config.scan_ports;
}

export function setScanPorts(ports: string[]): void {
  const config = loadConfig();
  config.scan_ports = ports;
  saveConfig(config);
}

export function resetConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
