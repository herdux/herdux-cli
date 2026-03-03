import type { CloudConfig } from "../config/config.service.js";
import type { S3Credentials } from "./s3.service.js";

export function resolveCloudCredentials(
  cloudConfig: CloudConfig,
): S3Credentials {
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID ?? cloudConfig.access_key_id ?? "";
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY ?? cloudConfig.secret_access_key ?? "";
  const region =
    process.env.AWS_DEFAULT_REGION ?? cloudConfig.region ?? "us-east-1";
  const endpoint = cloudConfig.endpoint;

  if (!accessKeyId) {
    throw new Error(
      "Cloud access key not configured. Run: hdx cloud config access-key KEY\n" +
        "  Or set env var: AWS_ACCESS_KEY_ID",
    );
  }

  if (!secretAccessKey) {
    throw new Error(
      "Cloud secret key not configured. Run: hdx cloud config secret-key KEY\n" +
        "  Or set env var: AWS_SECRET_ACCESS_KEY",
    );
  }

  return { accessKeyId, secretAccessKey, region, endpoint };
}
