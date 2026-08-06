import { randomUUID } from "crypto";
import { ApiError } from "./ApiError";
import { HttpStatus } from "./httpStatus";

import { IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "../constants";

export type UploadKind = "image" | "document";

const MAGIC_BYTES: Record<string, Array<number[]>> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [
    [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50],
  ],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "text/plain": [],
};

const DOCUMENT_MIME_TYPES = ["application/pdf", "text/plain"] as const;

export function isAllowedMime(kind: UploadKind, mime: string): boolean {
  if (kind === "image") {
    return (IMAGE_MIME_TYPES as readonly string[]).includes(mime);
  }
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export function maxSizeFor(kind: UploadKind): number {
  if (kind === "image") {
    return MAX_IMAGE_SIZE_BYTES;
  }
  return 10 * 1024 * 1024; // 10 MB documents
}

export function hasValidMagicBytes(mime: string, buffer: Buffer): boolean {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) {
    return false;
  }
  if (signatures.length === 0) {
    return true; // text/plain has no binary signature
  }
  const prefix = buffer.subarray(0, 12);
  return signatures.some((sig) => sig.every((byte, i) => byte === -1 || prefix[i] === byte));
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export function sniffImageDimensions(buffer: Buffer): ImageDimensions | null {
  // PNG: IHDR at offset 16 -> width (4 bytes BE), height (4 bytes BE)
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  // GIF: width/height as little-endian uint16 at offsets 6 and 8
  if (buffer.length >= 10 && buffer[0] === 0x47 && buffer[1] === 0x49) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }

  // JPEG: walk through segments to find SOF0/SOF2
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1]!;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }

  // WebP (lossy/lossless): dimensions at offset 26
  if (
    buffer.length >= 30 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45
  ) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  // AVIF: not statically sniffed here (ISO BMFF); validated by MIME + magic via sharp-free path
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return null;
  }

  return null;
}

const SAFE_NAME = /^[a-zA-Z0-9-_]+$/;

export function buildObjectKey(folder: string, originalName: string): string {
  const cleanedFolder = folder.replace(/[^a-zA-Z0-9-_/]/g, "").replace(/^\/+|\/+$/g, "");
  const ext = originalName.includes(".")
    ? originalName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)
    : "";
  const safeExt = ext && SAFE_NAME.test(ext) ? `.${ext}` : "";
  return `${cleanedFolder}/${randomUUID()}${safeExt}`;
}

export function validateUpload(kind: UploadKind, mime: string, buffer: Buffer): void {
  if (!isAllowedMime(kind, mime)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, `Unsupported file type "${mime}".`, { code: "UNSUPPORTED_MEDIA_TYPE" });
  }
  if (buffer.length > maxSizeFor(kind)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "File exceeds the maximum allowed size.", { code: "PAYLOAD_TOO_LARGE" });
  }
  if (buffer.length === 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Empty file.", { code: "BAD_REQUEST" });
  }
  if (!hasValidMagicBytes(mime, buffer)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "File content does not match its declared type.", { code: "BAD_REQUEST" });
  }
}
