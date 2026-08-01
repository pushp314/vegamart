import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { MAX_IMAGE_DIMENSION } from "../constants";
import { auditService } from "./audit.service";
import { deleteObject, uploadObject } from "../storage/r2.client";
import { ApiError } from "../utils/ApiError";
import {
  buildObjectKey,
  sniffImageDimensions,
  validateUpload,
} from "../utils/file-validation";
import { HttpStatus } from "../utils/httpStatus";

const ALLOWED_FOLDERS = ["products", "vendors", "profiles", "categories", "documents", "invoices"] as const;

export type UploadFolder = (typeof ALLOWED_FOLDERS)[number];

export const uploadService = {
  async uploadImage(
    userId: string,
    folder: UploadFolder,
    mime: string,
    buffer: Buffer,
    originalName: string,
    req: Request
  ): Promise<{ url: string; key: string; width: number | null; height: number | null; mime: string; size_bytes: number }> {
    this.ensureFolder(folder);
    validateUpload("image", mime, buffer);

    if (mime !== "image/gif" && mime !== "image/avif") {
      const dims = sniffImageDimensions(buffer);
      if (dims && (dims.width > MAX_IMAGE_DIMENSION || dims.height > MAX_IMAGE_DIMENSION)) {
        throw new ApiError(HttpStatus.BAD_REQUEST, `Image dimensions exceed ${MAX_IMAGE_DIMENSION}px.`, {
          code: "IMAGE_TOO_LARGE",
        });
      }
    }

    const key = buildObjectKey(folder, originalName);
    const url = await uploadObject({ key, body: buffer, contentType: mime });

    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.IMAGE_ADDED,
        entityType: "file",
        entityId: key,
        newValues: { url, folder, mime, size_bytes: buffer.length },
      },
      req
    );

    return { url, key, width: null, height: null, mime, size_bytes: buffer.length };
  },

  async uploadDocument(
    userId: string,
    folder: UploadFolder,
    mime: string,
    buffer: Buffer,
    originalName: string,
    req: Request
  ): Promise<{ url: string; key: string; mime: string; size_bytes: number }> {
    this.ensureFolder(folder);
    validateUpload("document", mime, buffer);

    const key = buildObjectKey(folder, originalName);
    const url = await uploadObject({ key, body: buffer, contentType: mime });

    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.FILE_UPLOADED,
        entityType: "file",
        entityId: key,
        newValues: { url, folder, mime, size_bytes: buffer.length },
      },
      req
    );

    return { url, key, mime, size_bytes: buffer.length };
  },

  async deleteFile(userId: string, key: string, req: Request): Promise<void> {
    if (!key || key.length > 500 || key.includes("..") || key.startsWith("/")) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid file key.", { code: "INVALID_FILE_KEY" });
    }
    await deleteObject(key);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.FILE_DELETED, entityType: "file", entityId: key },
      req
    );
  },

  ensureFolder(folder: UploadFolder): void {
    if (!(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid upload folder.", { code: "INVALID_FOLDER" });
    }
  },

  isAllowedFolder(folder: string): folder is UploadFolder {
    return (ALLOWED_FOLDERS as readonly string[]).includes(folder);
  },
};
