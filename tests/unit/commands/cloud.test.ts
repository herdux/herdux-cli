import { jest } from "@jest/globals";
import type { CloudConfig } from "../../../src/infra/config/config.service.js";
import type {
  S3Credentials,
  S3Object,
} from "../../../src/infra/cloud/s3.service.js";

// --- Mocks ---

const mockGetCloudConfig = jest.fn<() => CloudConfig>();
const mockSetCloudConfig = jest.fn<() => void>();
const mockResetCloudConfig = jest.fn<() => void>();

jest.unstable_mockModule("../../../src/infra/config/config.service.js", () => ({
  getCloudConfig: mockGetCloudConfig,
  setCloudConfig: mockSetCloudConfig,
  resetCloudConfig: mockResetCloudConfig,
}));

const mockResolveCreds = jest.fn<() => S3Credentials>();

jest.unstable_mockModule(
  "../../../src/infra/cloud/cloud-credential.js",
  () => ({
    resolveCloudCredentials: mockResolveCreds,
  }),
);

const mockUploadFile = jest.fn<() => Promise<string>>();
const mockDownloadFile = jest.fn<() => Promise<void>>();
const mockListObjects = jest.fn<() => Promise<S3Object[]>>();
const mockDeleteObject = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("../../../src/infra/cloud/s3.service.js", () => ({
  uploadFile: mockUploadFile,
  downloadFile: mockDownloadFile,
  listObjects: mockListObjects,
  deleteObject: mockDeleteObject,
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
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

const mockPrompts = jest.fn<() => Promise<Record<string, unknown>>>();

jest.unstable_mockModule("prompts", () => ({
  default: mockPrompts,
}));

jest.unstable_mockModule("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}));

// Load after mocks
const { registerCloudCommand } = await import("../../../src/commands/cloud.js");

// --- Helpers ---

type ActionFn = (...args: unknown[]) => Promise<void>;

function buildFakeProgram() {
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

  const cloudCmd = {
    helpCommand: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
    command: jest.fn((n: string) => makeSubCommand(n)),
  };

  const invokeSubAction = async (sub: string, ...args: unknown[]) => {
    const fn = subActions.get(sub);
    if (!fn) throw new Error(`action "${sub}" not registered`);
    try {
      await fn(...args);
    } catch {
      // swallow process.exit calls in tests
    }
  };

  const program = {
    command: jest.fn(() => cloudCmd),
    opts: jest.fn().mockReturnValue({}),
    invokeSubAction,
  };

  registerCloudCommand(program as never);
  return { program, subActions, invokeSubAction };
}

const CREDS: S3Credentials = {
  accessKeyId: "AKIAIO",
  secretAccessKey: "secret",
  region: "us-east-1",
};

const CLOUD_WITH_BUCKET: CloudConfig = {
  bucket: "my-bucket",
  region: "us-east-1",
};

// --- Tests ---

describe("hdx cloud", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers 'cloud' command on program", () => {
    const { program } = buildFakeProgram();
    expect(program.command).toHaveBeenCalledWith("cloud");
  });

  // --- config subcommand ---

  describe("config subcommand", () => {
    it("shows current config when no key/value provided", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);
      mockGetCloudConfig.mockReturnValue({ bucket: "my-bucket" });

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("config [key] [value]", undefined, undefined, {});

      expect(mockGetCloudConfig).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("sets a non-secret key without warning", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("config [key] [value]", "bucket", "my-bucket", {});

      expect(mockSetCloudConfig).toHaveBeenCalledWith("bucket", "my-bucket");
      consoleSpy.mockRestore();
    });

    it("sets access-key and shows plaintext warning", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("config [key] [value]", "access-key", "AKIAIO", {});

      expect(mockSetCloudConfig).toHaveBeenCalledWith(
        "access_key_id",
        "AKIAIO",
      );
      const calls = consoleSpy.mock.calls.flat().join(" ");
      expect(calls).toMatch(/plaintext/i);
      consoleSpy.mockRestore();
    });

    it("resets cloud config when --reset flag is set", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("config [key] [value]", undefined, undefined, {
        reset: true,
      });

      expect(mockResetCloudConfig).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("exits with error for unknown key", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exitSpy = jest
        .spyOn(process, "exit")
        .mockImplementation((() => undefined) as never);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("config [key] [value]", "unknown-key", "value", {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // --- list subcommand ---

  describe("list subcommand", () => {
    it("lists objects in bucket", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      const now = new Date("2026-03-03T14:23:00Z");
      mockListObjects.mockResolvedValue([
        { key: "backups/mydb.dump", size: 1200000, lastModified: now },
      ]);
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("list", { prefix: undefined });

      expect(mockListObjects).toHaveBeenCalledWith("my-bucket", "", CREDS);
      consoleSpy.mockRestore();
    });

    it("passes prefix to listObjects when --prefix is given", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      mockListObjects.mockResolvedValue([]);
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("list", { prefix: "backups/mydb/" });

      expect(mockListObjects).toHaveBeenCalledWith(
        "my-bucket",
        "backups/mydb/",
        CREDS,
      );
      consoleSpy.mockRestore();
    });

    it("shows warning when no objects found", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      mockListObjects.mockResolvedValue([]);
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("list", { prefix: undefined });

      expect(mockSpinnerWarn).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("exits with error when bucket is not configured", async () => {
      mockGetCloudConfig.mockReturnValue({});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exitSpy = jest
        .spyOn(process, "exit")
        .mockImplementation((() => undefined) as never);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("list", { prefix: undefined });

      expect(exitSpy).toHaveBeenCalledWith(1);
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // --- download subcommand ---

  describe("download subcommand", () => {
    it("downloads file to current directory", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      mockDownloadFile.mockResolvedValue(undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("download <key>", "backups/mydb.dump", {
        output: undefined,
      });

      expect(mockDownloadFile).toHaveBeenCalledWith(
        "my-bucket",
        "backups/mydb.dump",
        expect.stringContaining("mydb.dump"),
        CREDS,
      );
    });

    it("exits with error when bucket is not configured", async () => {
      mockGetCloudConfig.mockReturnValue({});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exitSpy = jest
        .spyOn(process, "exit")
        .mockImplementation((() => undefined) as never);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("download <key>", "file.dump", {
        output: undefined,
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // --- delete subcommand ---

  describe("delete subcommand", () => {
    it("deletes object without confirmation when --yes is set", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      mockDeleteObject.mockResolvedValue(undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("delete <key>", "backups/mydb.dump", { yes: true });

      expect(mockPrompts).not.toHaveBeenCalled();
      expect(mockDeleteObject).toHaveBeenCalledWith(
        "my-bucket",
        "backups/mydb.dump",
        CREDS,
      );
    });

    it("prompts for confirmation when --yes is not set", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      mockDeleteObject.mockResolvedValue(undefined);
      mockPrompts.mockResolvedValue({ confirmed: true });

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("delete <key>", "backups/mydb.dump", {
        yes: false,
      });

      expect(mockPrompts).toHaveBeenCalledTimes(1);
      expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    });

    it("cancels when user declines confirmation", async () => {
      mockGetCloudConfig.mockReturnValue(CLOUD_WITH_BUCKET);
      mockResolveCreds.mockReturnValue(CREDS);
      mockPrompts.mockResolvedValue({ confirmed: false });
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("delete <key>", "backups/mydb.dump", {
        yes: false,
      });

      expect(mockDeleteObject).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("exits with error when bucket is not configured", async () => {
      mockGetCloudConfig.mockReturnValue({});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exitSpy = jest
        .spyOn(process, "exit")
        .mockImplementation((() => undefined) as never);

      const { invokeSubAction } = buildFakeProgram();
      await invokeSubAction("delete <key>", "file.dump", { yes: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
