import { jest } from "@jest/globals";
import type { DatabaseContainer } from "../../../src/infra/docker/docker.service.js";

// --- Mocks ---

const mockIsDockerAvailable = jest.fn<() => Promise<boolean>>();
const mockListDatabaseContainers =
  jest.fn<() => Promise<DatabaseContainer[]>>();
const mockStartContainer = jest.fn<() => Promise<void>>();
const mockStopContainer = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("../../../src/infra/docker/docker.service.js", () => ({
  isDockerAvailable: mockIsDockerAvailable,
  listDatabaseContainers: mockListDatabaseContainers,
  startContainer: mockStartContainer,
  stopContainer: mockStopContainer,
}));

const mockSpinnerSucceed = jest.fn();
const mockSpinnerWarn = jest.fn();
const mockSpinnerStart = jest
  .fn()
  .mockReturnValue({ succeed: mockSpinnerSucceed, warn: mockSpinnerWarn });

jest.unstable_mockModule("ora", () => ({
  default: jest.fn().mockImplementation(() => ({ start: mockSpinnerStart })),
}));

jest.unstable_mockModule("chalk", () => ({
  default: {
    bold: (s: string) => s,
    cyan: (s: string) => s,
    gray: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
  },
}));

// Load module after mocks
const { registerDockerCommand } =
  await import("../../../src/commands/docker.js");

// --- Helpers ---

type ActionFn = (...args: unknown[]) => Promise<void>;

function buildFakeProgram() {
  let capturedCommandName: string | null = null;
  const subActions = new Map<string, ActionFn>();

  const makeSubCommand = (subName: string) => ({
    alias: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
    action(fn: ActionFn) {
      subActions.set(subName, fn);
      return this;
    },
    command: jest.fn((n: string) => makeSubCommand(n)),
  });

  const dockerCmd = {
    helpCommand: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
    command: jest.fn((n: string) => makeSubCommand(n)),
  };

  const program = {
    command: jest.fn((name: string) => {
      capturedCommandName = name;
      return dockerCmd;
    }),
    opts: jest.fn().mockReturnValue({}),
    invokeSubAction: async (sub: string, ...args: unknown[]) => {
      const fn = subActions.get(sub);
      if (!fn) throw new Error(`action "${sub}" not registered`);
      try {
        await fn(...args);
      } catch (err) {
        if (err instanceof Error && err.message !== "PROCESS_EXIT_MOCK")
          throw err;
      }
    },
  };

  return {
    program: program as unknown as typeof program,
    getCapturedCommandName: () => capturedCommandName,
  };
}

function makeContainer(
  overrides: Partial<DatabaseContainer> = {},
): DatabaseContainer {
  return {
    id: "abc123",
    name: "pg-dev",
    image: "postgres:15",
    hostPort: "5432",
    containerPort: "5432",
    status: "Up 2 hours",
    engineType: "postgres",
    ...overrides,
  };
}

// --- Tests ---

describe("registerDockerCommand", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
  let processExitSpy: ReturnType<typeof jest.spyOn>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("PROCESS_EXIT_MOCK");
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDockerAvailable.mockResolvedValue(true);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("registers a 'docker' command on the program", () => {
    const { program, getCapturedCommandName } = buildFakeProgram();
    registerDockerCommand(program as any);
    expect(getCapturedCommandName()).toBe("docker");
  });

  // --- docker list ---

  describe("docker list", () => {
    it("displays running containers in a table", async () => {
      mockListDatabaseContainers.mockResolvedValue([
        makeContainer({
          name: "pg-dev",
          engineType: "postgres",
          hostPort: "5432",
        }),
        makeContainer({
          name: "mysql-local",
          image: "mysql:8",
          engineType: "mysql",
          hostPort: "3306",
        }),
      ]);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("list", {});

      expect(mockListDatabaseContainers).toHaveBeenCalledWith(undefined);
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining("Found 2 running container(s)"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("pg-dev"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("mysql-local"),
      );
    });

    it("passes --all flag to listDatabaseContainers", async () => {
      mockListDatabaseContainers.mockResolvedValue([
        makeContainer({ status: "Exited (0) 1 hour ago" }),
      ]);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("list", { all: true });

      expect(mockListDatabaseContainers).toHaveBeenCalledWith(true);
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 container(s) found"),
      );
    });

    it("shows warning when no containers are found", async () => {
      mockListDatabaseContainers.mockResolvedValue([]);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("list", {});

      expect(mockSpinnerWarn).toHaveBeenCalledWith(
        expect.stringContaining("No running database containers found"),
      );
    });

    it("shows warning with different message when --all returns nothing", async () => {
      mockListDatabaseContainers.mockResolvedValue([]);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("list", { all: true });

      expect(mockSpinnerWarn).toHaveBeenCalledWith(
        expect.stringContaining("No database containers found"),
      );
    });

    it("exits with error when Docker is unavailable", async () => {
      mockIsDockerAvailable.mockResolvedValue(false);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("list", {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Docker is not available"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with error when listDatabaseContainers throws", async () => {
      mockListDatabaseContainers.mockRejectedValue(
        new Error("docker ps failed"),
      );

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("list", {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("docker ps failed"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // --- docker start ---

  describe("docker start", () => {
    it("starts a container and shows success message", async () => {
      mockStartContainer.mockResolvedValue(undefined);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("start <name>", "pg-dev");

      expect(mockStartContainer).toHaveBeenCalledWith("pg-dev");
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining('"pg-dev" started'),
      );
    });

    it("exits with error when startContainer throws", async () => {
      mockStartContainer.mockRejectedValue(
        new Error('No such container: "pg-dev"'),
      );

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("start <name>", "pg-dev");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No such container"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // --- docker stop ---

  describe("docker stop", () => {
    it("stops a container and shows success message", async () => {
      mockStopContainer.mockResolvedValue(undefined);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("stop <name>", "pg-dev", {});

      expect(mockStopContainer).toHaveBeenCalledWith("pg-dev", undefined);
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining('"pg-dev" stopped'),
      );
    });

    it("stops and removes a container when --remove is passed", async () => {
      mockStopContainer.mockResolvedValue(undefined);

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("stop <name>", "pg-dev", { remove: true });

      expect(mockStopContainer).toHaveBeenCalledWith("pg-dev", true);
      expect(mockSpinnerSucceed).toHaveBeenCalledWith(
        expect.stringContaining("stopped and removed"),
      );
    });

    it("exits with error when stopContainer throws", async () => {
      mockStopContainer.mockRejectedValue(
        new Error('No such container: "pg-dev"'),
      );

      const { program } = buildFakeProgram();
      registerDockerCommand(program as any);
      await program.invokeSubAction("stop <name>", "pg-dev", {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No such container"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
