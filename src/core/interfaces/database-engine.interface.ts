export interface DatabaseInstance {
  port: string;
  version: string;
  status: "running" | "unreachable";
}

export interface DatabaseInfo {
  name: string;
  owner?: string;
  encoding?: string;
  size?: string;
}

export type EngineType = "postgres" | "mysql";

export interface ConnectionOptions {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
}

export interface HealthCheckResult {
  status: "success" | "warn" | "error";
  message: string;
}

export interface HealthCheck {
  name: string;
  pendingMessage: string;
  run: (opts: ConnectionOptions) => Promise<HealthCheckResult>;
}

export interface IDatabaseEngine {
  /**
   * Returns a list of health checks that the doctor command can execute.
   */
  getHealthChecks(): HealthCheck[];

  /**
   * Returns the display name of the database engine (e.g., "PostgreSQL").
   */
  getEngineName(): string;

  /**
   * Returns engine-specific default connection options (host, port, user).
   */
  getDefaultConnectionOptions(): ConnectionOptions;

  /**
   * Validates the client tools (e.g., psql) and returns the client version.
   * Throws an error if required tools are missing.
   */
  checkClientVersion(): Promise<string>;

  /**
   * Validates the tools required for backup and restore operations (e.g., pg_dump).
   * Throws an error if required tools are missing.
   */
  checkBackupRequirements(): Promise<void>;

  /**
   * Discovers running instances of the database engine on the host.
   */
  discoverInstances(opts?: ConnectionOptions): Promise<DatabaseInstance[]>;

  /**
   * Retrieves the version of the database server.
   */
  getServerVersion(opts?: ConnectionOptions): Promise<string | null>;

  /**
   * Lists all available databases on the server.
   */
  listDatabases(
    opts?: ConnectionOptions & { includeSize?: boolean },
  ): Promise<DatabaseInfo[]>;

  /**
   * Creates a new database.
   */
  createDatabase(name: string, opts?: ConnectionOptions): Promise<void>;

  /**
   * Drops an existing database.
   */
  dropDatabase(name: string, opts?: ConnectionOptions): Promise<void>;

  /**
   * Backups a database to the specified output directory.
   * @returns the absolute path to the generated backup file.
   */
  backupDatabase(
    dbName: string,
    outputDir: string,
    opts?: ConnectionOptions,
    format?: string,
  ): Promise<string>;

  /**
   * Restores a database from a backup file.
   */
  restoreDatabase(
    filePath: string,
    dbName: string,
    opts?: ConnectionOptions,
    format?: string,
    clean?: boolean,
  ): Promise<{ hasWarnings: boolean; warnings?: string } | void>;
}
