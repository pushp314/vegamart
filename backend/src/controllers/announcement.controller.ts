import type { Request, Response } from "express";

import { announcementService } from "../services/announcement.service";
import { sendCreated, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";

/**
 * @swagger
 * /admin/announcements:
 *   get:
 *     summary: List announcements
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Paginated announcement list.
 */
export const listAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const result = await announcementService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/announcements:
 *   post:
 *     summary: Create an announcement
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               audience: { type: string, enum: [all, customer, vendor, delivery] }
 *               is_active: { type: boolean }
 *               scheduled_at: { type: string, format: date-time }
 *               publish: { type: boolean }
 *     responses:
 *       201:
 *         description: Announcement created.
 */
export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    title: string;
    body: string;
    audience?: "all" | "customer" | "vendor" | "delivery";
    is_active?: boolean;
    scheduled_at?: string | null;
    publish?: boolean;
  };
  const data = await announcementService.create(
    {
      title: body.title,
      body: body.body,
      audience: body.audience,
      is_active: body.is_active,
      scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
      publish: body.publish,
    },
    req.user!.id,
    req
  );
  return sendCreated(res, data, "Announcement created.");
});

/**
 * @swagger
 * /admin/announcements/{announcement_id}:
 *   get:
 *     summary: Get an announcement
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: announcement_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Announcement details.
 */
export const getAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = await announcementService.getById(req.params.announcement_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/announcements/{announcement_id}:
 *   patch:
 *     summary: Update an announcement
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: announcement_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               audience: { type: string, enum: [all, customer, vendor, delivery] }
 *               is_active: { type: boolean }
 *               scheduled_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Announcement updated.
 */
export const updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    title?: string;
    body?: string;
    audience?: "all" | "customer" | "vendor" | "delivery";
    is_active?: boolean;
    scheduled_at?: string | null;
  };
  const data = await announcementService.update(
    req.params.announcement_id as string,
    {
      title: body.title,
      body: body.body,
      audience: body.audience,
      is_active: body.is_active,
      scheduled_at: body.scheduled_at !== undefined ? (body.scheduled_at ? new Date(body.scheduled_at) : null) : undefined,
    },
    req.user!.id,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/announcements/{announcement_id}/publish:
 *   post:
 *     summary: Publish an announcement
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: announcement_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Announcement published.
 */
export const publishAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = await announcementService.publish(req.params.announcement_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/announcements/{announcement_id}/unpublish:
 *   post:
 *     summary: Unpublish an announcement
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: announcement_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Announcement unpublished.
 */
export const unpublishAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = await announcementService.unpublish(req.params.announcement_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/announcements/{announcement_id}:
 *   delete:
 *     summary: Delete an announcement
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: announcement_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Announcement deleted.
 */
export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = await announcementService.remove(req.params.announcement_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});
