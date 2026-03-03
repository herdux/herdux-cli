import { jest } from "@jest/globals";

// --- Mocks ---

const mockSend = jest.fn<() => Promise<unknown>>();
const mockS3Client = jest.fn(() => ({ send: mockSend }));
const mockGetObjectCommand = jest.fn();
const mockListObjectsV2Command = jest.fn();
const mockDeleteObjectCommand = jest.fn();

jest.unstable_mockModule("@aws-sdk/client-s3", () => ({
  S3Client: mockS3Client,
  GetObjectCommand: mockGetObjectCommand,
  ListObjectsV2Command: mockListObjectsV2Command,
  DeleteObjectCommand: mockDeleteObjectCommand,
}));

const mockUploadDone = jest.fn<() => Promise<void>>();
const mockUpload = jest.fn(() => ({ done: mockUploadDone }));

jest.unstable_mockModule("@aws-sdk/lib-storage", () => ({
  Upload: mockUpload,
}));

const mockCreateReadStream = jest.fn();
const mockCreateWriteStream = jest.fn();

jest.unstable_mockModule("fs", () => ({
  createReadStream: mockCreateReadStream,
  createWriteStream: mockCreateWriteStream,
}));

const mockPipeline = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("stream/promises", () => ({
  pipeline: mockPipeline,
}));

const { uploadFile, downloadFile, listObjects, deleteObject, listDirectory } =
  await import("../../../src/infra/cloud/s3.service.js");

// --- Helpers ---

const CREDS = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI",
  region: "us-east-1",
};

// --- Tests ---

describe("s3.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- uploadFile ---

  describe("uploadFile()", () => {
    it("creates an Upload with correct params and calls done()", async () => {
      const fakeStream = {};
      mockCreateReadStream.mockReturnValue(fakeStream);
      mockUploadDone.mockResolvedValue(undefined);

      const result = await uploadFile(
        "/tmp/mydb.dump",
        "my-bucket",
        "backups/mydb.dump",
        CREDS,
      );

      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            Bucket: "my-bucket",
            Key: "backups/mydb.dump",
            Body: fakeStream,
          },
        }),
      );
      expect(mockUploadDone).toHaveBeenCalledTimes(1);
      expect(result).toBe("s3://my-bucket/backups/mydb.dump");
    });

    it("creates S3Client with custom endpoint when provided", async () => {
      mockCreateReadStream.mockReturnValue({});
      mockUploadDone.mockResolvedValue(undefined);

      await uploadFile("/tmp/file.dump", "bucket", "file.dump", {
        ...CREDS,
        endpoint: "https://account.r2.cloudflarestorage.com",
      });

      expect(mockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://account.r2.cloudflarestorage.com",
          forcePathStyle: true,
        }),
      );
    });
  });

  // --- downloadFile ---

  describe("downloadFile()", () => {
    it("sends GetObjectCommand and pipes Body to file", async () => {
      const fakeBody = { pipe: jest.fn() };
      const fakeWriter = {};
      mockSend.mockResolvedValue({ Body: fakeBody });
      mockCreateWriteStream.mockReturnValue(fakeWriter);
      mockPipeline.mockResolvedValue(undefined);

      await downloadFile(
        "my-bucket",
        "backups/mydb.dump",
        "/tmp/mydb.dump",
        CREDS,
      );

      expect(mockGetObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "backups/mydb.dump",
      });
      expect(mockPipeline).toHaveBeenCalledWith(fakeBody, fakeWriter);
    });

    it("throws when response Body is empty", async () => {
      mockSend.mockResolvedValue({ Body: undefined });
      mockCreateWriteStream.mockReturnValue({});

      await expect(
        downloadFile("my-bucket", "missing.dump", "/tmp/out.dump", CREDS),
      ).rejects.toThrow("Empty response body");
    });
  });

  // --- listObjects ---

  describe("listObjects()", () => {
    it("returns mapped objects from response Contents", async () => {
      const now = new Date("2026-03-03T14:23:00Z");
      mockSend.mockResolvedValue({
        Contents: [
          { Key: "backups/mydb.dump", Size: 1200000, LastModified: now },
          { Key: "backups/other.dump", Size: 900000, LastModified: now },
        ],
        NextContinuationToken: undefined,
      });

      const result = await listObjects("my-bucket", "backups/", CREDS);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: "backups/mydb.dump",
        size: 1200000,
        lastModified: now,
      });
    });

    it("returns empty array when bucket is empty", async () => {
      mockSend.mockResolvedValue({
        Contents: [],
        NextContinuationToken: undefined,
      });

      const result = await listObjects("my-bucket", "", CREDS);

      expect(result).toHaveLength(0);
    });

    it("paginates using NextContinuationToken until exhausted", async () => {
      const now = new Date();
      mockSend
        .mockResolvedValueOnce({
          Contents: [{ Key: "a.dump", Size: 1, LastModified: now }],
          NextContinuationToken: "token1",
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: "b.dump", Size: 2, LastModified: now }],
          NextContinuationToken: undefined,
        });

      const result = await listObjects("my-bucket", "", CREDS);

      expect(result).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("skips objects missing Key, Size, or LastModified", async () => {
      const now = new Date();
      mockSend.mockResolvedValue({
        Contents: [
          { Key: "valid.dump", Size: 100, LastModified: now },
          { Key: undefined, Size: 100, LastModified: now },
          { Key: "no-size.dump", Size: undefined, LastModified: now },
        ],
        NextContinuationToken: undefined,
      });

      const result = await listObjects("my-bucket", "", CREDS);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("valid.dump");
    });
  });

  // --- deleteObject ---

  describe("deleteObject()", () => {
    it("sends DeleteObjectCommand with correct Bucket and Key", async () => {
      mockSend.mockResolvedValue({});

      await deleteObject("my-bucket", "backups/mydb.dump", CREDS);

      expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "backups/mydb.dump",
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  // --- listDirectory ---

  describe("listDirectory()", () => {
    it("returns files and dirs for the given prefix level", async () => {
      const now = new Date("2026-03-03T14:23:00Z");
      mockSend.mockResolvedValue({
        Contents: [{ Key: "backups/file.dump", Size: 1000, LastModified: now }],
        CommonPrefixes: [
          { Prefix: "backups/subdir/" },
          { Prefix: "backups/other/" },
        ],
        NextContinuationToken: undefined,
      });

      const result = await listDirectory("my-bucket", "backups/", CREDS);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].key).toBe("backups/file.dump");
      expect(result.dirs).toEqual(["backups/subdir/", "backups/other/"]);
    });

    it("skips folder marker objects (0-byte keys ending with /)", async () => {
      const now = new Date();
      mockSend.mockResolvedValue({
        Contents: [
          { Key: "backups/", Size: 0, LastModified: now },
          { Key: "backups/real.dump", Size: 500, LastModified: now },
        ],
        CommonPrefixes: [],
        NextContinuationToken: undefined,
      });

      const result = await listDirectory("my-bucket", "backups/", CREDS);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].key).toBe("backups/real.dump");
    });

    it("returns empty files and dirs when prefix has no content", async () => {
      mockSend.mockResolvedValue({
        Contents: [],
        CommonPrefixes: [],
        NextContinuationToken: undefined,
      });

      const result = await listDirectory("my-bucket", "empty/", CREDS);

      expect(result.files).toHaveLength(0);
      expect(result.dirs).toHaveLength(0);
    });

    it("sends ListObjectsV2Command with Delimiter set to /", async () => {
      mockSend.mockResolvedValue({
        Contents: [],
        CommonPrefixes: [],
        NextContinuationToken: undefined,
      });

      await listDirectory("my-bucket", "backups/", CREDS);

      expect(mockListObjectsV2Command).toHaveBeenCalledWith(
        expect.objectContaining({ Delimiter: "/" }),
      );
    });
  });
});
