import { jest } from "@jest/globals";

const CREDS = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI",
  region: "us-east-1",
};

const { resolveCloudCredentials } =
  await import("../../../src/infra/cloud/cloud-credential.js");

describe("resolveCloudCredentials()", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_DEFAULT_REGION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("resolves credentials from config when env vars are absent", () => {
    const result = resolveCloudCredentials({
      access_key_id: CREDS.accessKeyId,
      secret_access_key: CREDS.secretAccessKey,
      region: CREDS.region,
    });

    expect(result.accessKeyId).toBe(CREDS.accessKeyId);
    expect(result.secretAccessKey).toBe(CREDS.secretAccessKey);
    expect(result.region).toBe(CREDS.region);
  });

  it("env vars take priority over config values", () => {
    process.env.AWS_ACCESS_KEY_ID = "ENV_KEY";
    process.env.AWS_SECRET_ACCESS_KEY = "ENV_SECRET";
    process.env.AWS_DEFAULT_REGION = "eu-west-1";

    const result = resolveCloudCredentials({
      access_key_id: "CONFIG_KEY",
      secret_access_key: "CONFIG_SECRET",
      region: "us-east-1",
    });

    expect(result.accessKeyId).toBe("ENV_KEY");
    expect(result.secretAccessKey).toBe("ENV_SECRET");
    expect(result.region).toBe("eu-west-1");
  });

  it("defaults region to us-east-1 when not provided anywhere", () => {
    const result = resolveCloudCredentials({
      access_key_id: CREDS.accessKeyId,
      secret_access_key: CREDS.secretAccessKey,
    });

    expect(result.region).toBe("us-east-1");
  });

  it("includes endpoint when set in config", () => {
    const result = resolveCloudCredentials({
      access_key_id: CREDS.accessKeyId,
      secret_access_key: CREDS.secretAccessKey,
      endpoint: "https://account.r2.cloudflarestorage.com",
    });

    expect(result.endpoint).toBe("https://account.r2.cloudflarestorage.com");
  });

  it("throws when access key is missing", () => {
    expect(() =>
      resolveCloudCredentials({
        secret_access_key: CREDS.secretAccessKey,
      }),
    ).toThrow("Cloud access key not configured");
  });

  it("throws with helpful message pointing to hdx cloud config", () => {
    expect(() =>
      resolveCloudCredentials({ secret_access_key: CREDS.secretAccessKey }),
    ).toThrow("hdx cloud config access-key KEY");
  });

  it("throws when secret key is missing", () => {
    expect(() =>
      resolveCloudCredentials({
        access_key_id: CREDS.accessKeyId,
      }),
    ).toThrow("Cloud secret key not configured");
  });
});
