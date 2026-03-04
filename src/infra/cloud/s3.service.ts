import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint?: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
}

function createClient(creds: S3Credentials): S3Client {
  return new S3Client({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    ...(creds.endpoint
      ? { endpoint: creds.endpoint, forcePathStyle: true }
      : {}),
  });
}

export async function uploadFile(
  filePath: string,
  bucket: string,
  key: string,
  creds: S3Credentials,
): Promise<string> {
  const client = createClient(creds);
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
    },
  });
  await upload.done();
  return `s3://${bucket}/${key}`;
}

export async function downloadFile(
  bucket: string,
  key: string,
  destPath: string,
  creds: S3Credentials,
): Promise<void> {
  const client = createClient(creds);
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`Empty response body for s3://${bucket}/${key}`);
  }

  const writer = createWriteStream(destPath);
  await pipeline(response.Body as NodeJS.ReadableStream, writer);
}

export async function listObjects(
  bucket: string,
  prefix: string,
  creds: S3Credentials,
): Promise<S3Object[]> {
  const client = createClient(creds);
  const objects: S3Object[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents ?? []) {
      if (obj.Key && obj.Size !== undefined && obj.LastModified) {
        objects.push({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

export async function deleteObject(
  bucket: string,
  key: string,
  creds: S3Credentials,
): Promise<void> {
  const client = createClient(creds);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export interface S3DirResult {
  files: S3Object[];
  dirs: string[];
}

export async function listDirectory(
  bucket: string,
  prefix: string,
  creds: S3Credentials,
): Promise<S3DirResult> {
  const client = createClient(creds);
  const files: S3Object[] = [];
  const dirs: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents ?? []) {
      if (obj.Key && obj.Size !== undefined && obj.LastModified) {
        if (obj.Key.endsWith("/") && obj.Size === 0) continue;
        files.push({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
        });
      }
    }

    for (const cp of response.CommonPrefixes ?? []) {
      if (cp.Prefix) dirs.push(cp.Prefix);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return { files, dirs };
}

export type S3KeyType = "file" | "directory" | "not-found";

export async function classifyKey(
  bucket: string,
  key: string,
  creds: S3Credentials,
): Promise<S3KeyType> {
  const client = createClient(creds);

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return "file";
  } catch {
    // Key does not exist as an exact object — check if it is a directory prefix
  }

  const dirPrefix = key.endsWith("/") ? key : `${key}/`;
  const response = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: dirPrefix, MaxKeys: 1 }),
  );

  if (
    (response.Contents?.length ?? 0) > 0 ||
    (response.CommonPrefixes?.length ?? 0) > 0
  ) {
    return "directory";
  }

  return "not-found";
}
