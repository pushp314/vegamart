import type { Request, Response } from "express";

import { uploadService } from "../services/upload.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

function assertSingleFile(req: Request): Express.Multer.File {
  const file = req.file;
  if (!file) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "No file uploaded. Field name must be \"file\".", {
      code: "NO_FILE",
    });
  }
  return file;
}

/**
 * @swagger
 * /upload/image:
 *   post:
 *     summary: Upload an image to R2 storage
 *     description: Accepts multipart form-data with a "file" field. Allowed image MIME types: jpeg, png, webp, avif, gif. Max 5 MB.
 *     security:
 *       - bearerAuth: []
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, folder]
 *             properties:
 *               file: { type: string, format: binary }
 *               folder: { type: string, enum: [products, vendors, profiles, categories, documents, invoices] }
 *     responses:
 *       201:
 *         description: Uploaded file URL.
 *       400:
 *         description: Invalid file or folder.
 */
export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const file = assertSingleFile(req);
  const folder = req.body.folder as string;
  if (!uploadService.isAllowedFolder(folder)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid upload folder.", { code: "INVALID_FOLDER" });
  }
  const result = await uploadService.uploadImage(
    req.user!.id,
    folder,
    file.mimetype,
    file.buffer,
    file.originalname,
    req
  );
  return sendSuccess(res, result, { status: HttpStatus.CREATED });
});

/**
 * @swagger
 * /upload/document:
 *   post:
 *     summary: Upload a document to R2 storage
 *     description: Accepts multipart form-data with a "file" field. Allowed document MIME types: application/pdf, text/plain. Max 10 MB.
 *     security:
 *       - bearerAuth: []
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, folder]
 *             properties:
 *               file: { type: string, format: binary }
 *               folder: { type: string, enum: [products, vendors, profiles, categories, documents, invoices] }
 *     responses:
 *       201:
 *         description: Uploaded file URL.
 *       400:
 *         description: Invalid file or folder.
 */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = assertSingleFile(req);
  const folder = req.body.folder as string;
  if (!uploadService.isAllowedFolder(folder)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid upload folder.", { code: "INVALID_FOLDER" });
  }
  const result = await uploadService.uploadDocument(
    req.user!.id,
    folder,
    file.mimetype,
    file.buffer,
    file.originalname,
    req
  );
  return sendSuccess(res, result, { status: HttpStatus.CREATED });
});

/**
 * @swagger
 * /upload/image:
 *   delete:
 *     summary: Delete an uploaded file
 *     description: Body carries the R2 object key to remove.
 *     security:
 *       - bearerAuth: []
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key: { type: string }
 *     responses:
 *       200:
 *         description: File deleted.
 *       400:
 *         description: Invalid file key.
 */
export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.body as { key?: string };
  if (!key) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "key is required.", { code: "INVALID_FILE_KEY" });
  }
  await uploadService.deleteFile(req.user!.id, key, req);
  return sendSuccess(res, { success: true });
});
