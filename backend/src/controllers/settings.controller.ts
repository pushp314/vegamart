import type { Request, Response } from "express";

import { settingsService } from "../services/settings.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get all platform settings
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Merged platform settings.
 */
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const data = await settingsService.getAllSettings();
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/settings:
 *   patch:
 *     summary: Update platform settings
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Updated settings.
 */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await settingsService.updateSettings(req.body as never, req.user!.id, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /settings/public:
 *   get:
 *     summary: Get public platform settings (no auth)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Public settings.
 */
export const getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const data = await settingsService.getPublicSettings();
  return sendSuccess(res, data);
});
