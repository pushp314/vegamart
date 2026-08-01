import type { Request, Response } from "express";

import * as notificationRepo from "../repositories/notification.repository";
import { ApiError } from "../utils/ApiError";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import { HttpStatus } from "../utils/httpStatus";

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List the current user's notifications
 *     security:
 *       - bearerAuth: []
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [order, payment, promotional, system, delivery, vendor] }
 *         description: Filter notifications by category/type.
 *     responses:
 *       200:
 *         description: Paginated notification list.
 */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { page?: string; per_page?: string; type?: string };
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.per_page) || 20));
  const { rows, total } = await notificationRepo.listByUser(
    req.user!.id,
    (page - 1) * perPage,
    perPage,
    query.type
  );
  return sendSuccess(res, rows, {
    pagination: buildPaginationMeta({ page, per_page: perPage }, total),
  });
});

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Count unread notifications for the current user
 *     security:
 *       - bearerAuth: []
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Unread count.
 */
export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationRepo.countUnread(req.user!.id);
  return sendSuccess(res, { count });
});

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: All notifications marked as read.
 */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationRepo.markAllRead(req.user!.id);
  return sendSuccess(res, { success: true });
});

/**
 * @swagger
 * /notifications/{notification_id}/read:
 *   post:
 *     summary: Mark a notification as read
 *     security:
 *       - bearerAuth: []
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: notification_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification marked as read.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const ok = await notificationRepo.markRead(req.user!.id, req.params.notification_id as string);
  if (!ok) {
    throw new ApiError(HttpStatus.NOT_FOUND, "Notification not found.", { code: "NOT_FOUND" });
  }
  return sendSuccess(res, { success: true });
});

/**
 * @swagger
 * /notifications/{notification_id}:
 *   delete:
 *     summary: Delete a notification
 *     security:
 *       - bearerAuth: []
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: notification_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification deleted.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const removeNotification = asyncHandler(async (req: Request, res: Response) => {
  const ok = await notificationRepo.deleteNotification(req.user!.id, req.params.notification_id as string);
  if (!ok) {
    throw new ApiError(HttpStatus.NOT_FOUND, "Notification not found.", { code: "NOT_FOUND" });
  }
  return sendSuccess(res, { success: true });
});
