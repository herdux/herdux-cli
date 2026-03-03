import { jest } from "@jest/globals";

// --- Mocks ---

const mockRunCommand =
  jest.fn<
    () => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >();
const mockBinaryExists = jest.fn<() => Promise<boolean>>();

jest.unstable_mockModule("../../../src/infra/command-runner.js", () => ({
  runCommand: mockRunCommand,
}));

jest.unstable_mockModule("../../../src/infra/utils/detect-binary.js", () => ({
  binaryExists: mockBinaryExists,
}));

// Load module after mocks
const {
  isDockerAvailable,
  listDatabaseContainers,
  startContainer,
  stopContainer,
} = await import("../../../src/infra/docker/docker.service.js");

// --- Helpers ---

function ok(stdout = ""): { stdout: string; stderr: string; exitCode: number } {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr = "error"): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return { stdout: "", stderr, exitCode: 1 };
}

// --- Tests ---

describe("docker.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- isDockerAvailable ---

  describe("isDockerAvailable()", () => {
    it("returns true when binary exists and daemon responds", async () => {
      mockBinaryExists.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(ok("24.0.5"));

      const result = await isDockerAvailable();

      expect(result).toBe(true);
      expect(mockRunCommand).toHaveBeenCalledWith(
        "docker",
        ["info", "--format", "{{.ServerVersion}}"],
        { timeout: 5_000 },
      );
    });

    it("returns false when docker binary is not installed", async () => {
      mockBinaryExists.mockResolvedValue(false);

      const result = await isDockerAvailable();

      expect(result).toBe(false);
      expect(mockRunCommand).not.toHaveBeenCalled();
    });

    it("returns false when daemon is not running", async () => {
      mockBinaryExists.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(
        fail("Cannot connect to the Docker daemon"),
      );

      const result = await isDockerAvailable();

      expect(result).toBe(false);
    });
  });

  // --- listDatabaseContainers ---

  describe("listDatabaseContainers()", () => {
    const pgLine =
      "abc123\tpg-dev\tpostgres:15\t0.0.0.0:5432->5432/tcp\tUp 2 hours";
    const mysqlLine =
      "def456\tmysql-local\tmysql:8\t0.0.0.0:3306->3306/tcp\tUp 1 hour";
    const nginxLine =
      "ghi789\tnginx-web\tnginx:latest\t0.0.0.0:80->80/tcp\tUp 5 minutes";

    it("returns only database containers (filters non-DB images)", async () => {
      mockRunCommand.mockResolvedValue(
        ok([pgLine, mysqlLine, nginxLine].join("\n")),
      );

      const containers = await listDatabaseContainers();

      expect(containers).toHaveLength(2);
      expect(containers[0].name).toBe("pg-dev");
      expect(containers[1].name).toBe("mysql-local");
    });

    it("detects postgres engine type and container port", async () => {
      mockRunCommand.mockResolvedValue(ok(pgLine));

      const [c] = await listDatabaseContainers();

      expect(c.engineType).toBe("postgres");
      expect(c.containerPort).toBe("5432");
      expect(c.hostPort).toBe("5432");
    });

    it("detects mysql engine type and container port", async () => {
      mockRunCommand.mockResolvedValue(ok(mysqlLine));

      const [c] = await listDatabaseContainers();

      expect(c.engineType).toBe("mysql");
      expect(c.containerPort).toBe("3306");
      expect(c.hostPort).toBe("3306");
    });

    it("detects mariadb as mysql engine type", async () => {
      const mariaLine =
        "jkl000\tmariadb-dev\tmariadb:10.11\t0.0.0.0:3306->3306/tcp\tUp 3 hours";
      mockRunCommand.mockResolvedValue(ok(mariaLine));

      const [c] = await listDatabaseContainers();

      expect(c.engineType).toBe("mysql");
    });

    it("passes --all flag when showAll is true", async () => {
      mockRunCommand.mockResolvedValue(ok(""));

      await listDatabaseContainers(true);

      expect(mockRunCommand).toHaveBeenCalledWith(
        "docker",
        expect.arrayContaining(["--all"]),
      );
    });

    it("returns empty array when no DB containers are running", async () => {
      mockRunCommand.mockResolvedValue(ok(""));

      const containers = await listDatabaseContainers();

      expect(containers).toHaveLength(0);
    });

    it("sets hostPort to empty string when ports column is empty", async () => {
      const noPortLine = "abc123\tpg-dev\tpostgres:15\t\tExited (0) 1 hour ago";
      mockRunCommand.mockResolvedValue(ok(noPortLine));

      const [c] = await listDatabaseContainers();

      expect(c.hostPort).toBe("");
    });

    it("throws when docker ps fails", async () => {
      mockRunCommand.mockResolvedValue(fail("permission denied"));

      await expect(listDatabaseContainers()).rejects.toThrow(
        "permission denied",
      );
    });
  });

  // --- startContainer ---

  describe("startContainer()", () => {
    it("runs docker start with the container name", async () => {
      mockRunCommand.mockResolvedValue(ok("pg-dev"));

      await startContainer("pg-dev");

      expect(mockRunCommand).toHaveBeenCalledWith("docker", [
        "start",
        "pg-dev",
      ]);
    });

    it("throws when docker start fails", async () => {
      mockRunCommand.mockResolvedValue(fail('No such container: "pg-dev"'));

      await expect(startContainer("pg-dev")).rejects.toThrow(
        "No such container",
      );
    });
  });

  // --- stopContainer ---

  describe("stopContainer()", () => {
    it("runs docker stop without remove by default", async () => {
      mockRunCommand.mockResolvedValue(ok("pg-dev"));

      await stopContainer("pg-dev");

      expect(mockRunCommand).toHaveBeenCalledTimes(1);
      expect(mockRunCommand).toHaveBeenCalledWith("docker", ["stop", "pg-dev"]);
    });

    it("runs docker stop then docker rm when remove=true", async () => {
      mockRunCommand
        .mockResolvedValueOnce(ok("pg-dev"))
        .mockResolvedValueOnce(ok("pg-dev"));

      await stopContainer("pg-dev", true);

      expect(mockRunCommand).toHaveBeenCalledTimes(2);
      expect(mockRunCommand).toHaveBeenNthCalledWith(1, "docker", [
        "stop",
        "pg-dev",
      ]);
      expect(mockRunCommand).toHaveBeenNthCalledWith(2, "docker", [
        "rm",
        "pg-dev",
      ]);
    });

    it("throws when docker stop fails", async () => {
      mockRunCommand.mockResolvedValue(fail('No such container: "pg-dev"'));

      await expect(stopContainer("pg-dev")).rejects.toThrow(
        "No such container",
      );
    });

    it("throws when docker rm fails after successful stop", async () => {
      mockRunCommand
        .mockResolvedValueOnce(ok("pg-dev"))
        .mockResolvedValueOnce(fail("removal failed"));

      await expect(stopContainer("pg-dev", true)).rejects.toThrow(
        "removal failed",
      );
    });
  });
});
