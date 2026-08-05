import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../config";
import log from "../config/logger";

let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME
  );
}

function getClient(): S3Client | null {
  if (!isR2Configured()) {
    return null;
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export interface R2UploadInput {
  key: string;
  body: Buffer;
  contentType: string;
}

const FALLBACK_IMAGE_BASE = "https://placehold.co/600x400";

function placeholderUrl(key: string): string {
  const text = encodeURIComponent(key.split("/").pop() || "Image");
  return `${FALLBACK_IMAGE_BASE}?text=${text}`;
}

export function publicUrl(key: string): string {
  if (!isR2Configured()) {
    return placeholderUrl(key);
  }
  if (env.R2_PUBLIC_URL) {
    const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
    return `${base}/${key}`;
  }
  return `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

export async function uploadObject(input: R2UploadInput): Promise<string> {
  const s3 = getClient();
  if (!s3) {
    log.warn(`[r2] R2 not configured — upload skipped for key "${input.key}".`);
    return publicUrl(input.key);
  }
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      })
    );
    log.info(`[r2] Uploaded ${input.key}`, { context: "storage", bytes: input.body.length });
    return publicUrl(input.key);
  } catch (error) {
    log.error(`[r2] Upload failed for ${input.key}`, {
      context: "storage",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    return `https://placehold.co/600x400?text=${encodeURIComponent(input.key.split("/").pop() || "Mock+Image")}`;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const s3 = getClient();
  if (!s3) {
    log.warn(`[r2] R2 not configured — delete skipped for key "${key}".`);
    return;
  }
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    log.info(`[r2] Deleted ${key}`, { context: "storage" });
  } catch (error) {
    log.error(`[r2] Delete failed for ${key}`, {
      context: "storage",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    throw new Error(`R2 delete failed: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}
