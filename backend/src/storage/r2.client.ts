import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../config";
import log from "../config/logger";

let client: S3Client | null = null;

export interface R2StorageMetrics {
  configured: boolean;
  bucket_name: string | null;
  total_bytes: number;
  total_objects: number;
  used_mb: number;
  used_gb: number;
  quota_gb: number;
  percent_used: number;
  is_near_full: boolean;
  is_full: boolean;
  status: "OK" | "WARNING" | "CRITICAL";
  message: string;
}

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
    if (env.NODE_ENV === "production") {
      throw new Error("R2 is not configured. Cannot process uploads in production.");
    }
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
    if (env.NODE_ENV === "production") {
      throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
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

export function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  
  if (env.R2_PUBLIC_URL) {
    const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
    if (url.startsWith(`${base}/`)) {
      return url.slice(base.length + 1);
    }
  }
  
  const rawBase = `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  if (url.startsWith(`${rawBase}/`)) {
    return url.slice(rawBase.length + 1);
  }
  
  return null;
}

export async function getStorageMetrics(): Promise<R2StorageMetrics> {
  const quotaGb = Number((env as any).R2_QUOTA_GB || 10); // Standard R2 tier default 10GB
  if (!isR2Configured()) {
    return {
      configured: false,
      bucket_name: null,
      total_bytes: 0,
      total_objects: 0,
      used_mb: 0,
      used_gb: 0,
      quota_gb: quotaGb,
      percent_used: 0,
      is_near_full: false,
      is_full: false,
      status: "OK",
      message: "R2 storage is not configured (using local / mock storage)",
    };
  }

  const s3 = getClient();
  if (!s3) {
    return {
      configured: false,
      bucket_name: env.R2_BUCKET_NAME || null,
      total_bytes: 0,
      total_objects: 0,
      used_mb: 0,
      used_gb: 0,
      quota_gb: quotaGb,
      percent_used: 0,
      is_near_full: false,
      is_full: false,
      status: "OK",
      message: "R2 client initialization skipped",
    };
  }

  try {
    let totalBytes = 0;
    let totalObjects = 0;
    let continuationToken: string | undefined = undefined;

    // List objects and compute aggregate storage usage (capped to first 10k objects to avoid slowdowns)
    let pageCount = 0;
    do {
      const response: any = await s3.send(
        new ListObjectsV2Command({
          Bucket: env.R2_BUCKET_NAME,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          totalBytes += obj.Size || 0;
          totalObjects += 1;
        }
      }

      continuationToken = response.NextContinuationToken;
      pageCount += 1;
    } while (continuationToken && pageCount < 10);

    const usedMb = Number((totalBytes / (1024 * 1024)).toFixed(2));
    const usedGb = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3));
    const percentUsed = Number(((usedGb / quotaGb) * 100).toFixed(1));
    const isNearFull = percentUsed >= 80;
    const isFull = percentUsed >= 95;

    let status: "OK" | "WARNING" | "CRITICAL" = "OK";
    let message = `Cloudflare R2 Storage healthy (${usedGb} GB / ${quotaGb} GB used).`;

    if (isFull) {
      status = "CRITICAL";
      message = `CRITICAL: Cloudflare R2 Storage is at ${percentUsed}% capacity (${usedGb} GB / ${quotaGb} GB). Uploads may fail!`;
    } else if (isNearFull) {
      status = "WARNING";
      message = `WARNING: Cloudflare R2 Storage is nearing capacity at ${percentUsed}% (${usedGb} GB / ${quotaGb} GB). Clean up media to prevent disruptions.`;
    }

    return {
      configured: true,
      bucket_name: env.R2_BUCKET_NAME || null,
      total_bytes: totalBytes,
      total_objects: totalObjects,
      used_mb: usedMb,
      used_gb: usedGb,
      quota_gb: quotaGb,
      percent_used: percentUsed,
      is_near_full: isNearFull,
      is_full: isFull,
      status,
      message,
    };
  } catch (error) {
    log.error("[r2] Failed to calculate storage metrics", {
      context: "storage",
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      configured: true,
      bucket_name: env.R2_BUCKET_NAME || null,
      total_bytes: 0,
      total_objects: 0,
      used_mb: 0,
      used_gb: 0,
      quota_gb: quotaGb,
      percent_used: 0,
      is_near_full: false,
      is_full: false,
      status: "OK",
      message: "Unable to query Cloudflare R2 storage usage",
    };
  }
}
