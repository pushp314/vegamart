import type { Request, Response } from "express";

import { deliveryService } from "../services/delivery.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";

/**
 * @swagger
 * /delivery/me/stats:
 *   get:
 *     summary: Get delivery partner dashboard stats
 *     security:
 *       - bearerAuth: []
 *     tags: [Delivery]
 *     responses:
 *       200:
 *         description: Delivery partner stats.
 */
export const getMyStats = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.getMyStats(req.user!.id);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /delivery/me/earnings:
 *   get:
 *     summary: Get delivery partner earnings history
 *     security:
 *       - bearerAuth: []
 *     tags: [Delivery]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [today, week, month, all] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Earnings history.
 */
export const getMyEarnings = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { period?: string; page?: string; per_page?: string };
  const result = await deliveryService.getMyEarnings(req.user!.id, {
    period: query.period,
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
  });
  return sendSuccess(res, {
    earnings: result.earnings,
    summary: result.summary,
  }, {
    pagination: buildPaginationMeta(
      { page: result.pagination.page, per_page: result.pagination.per_page },
      result.pagination.total
    ),
  });
});

/**
 * @swagger
 * /delivery/me/availability:
 *   put:
 *     summary: Toggle delivery partner availability
 *     security:
 *       - bearerAuth: []
 *     tags: [Delivery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [is_available]
 *             properties:
 *               is_available: { type: boolean }
 *     responses:
 *       200:
 *         description: Availability updated.
 */
export const setAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { is_available } = req.body as { is_available: boolean };
  const data = await deliveryService.setAvailability(req.user!.id, is_available, req);
  return sendSuccess(res, data, { message: "Availability updated." });
});

/**
 * @swagger
 * /delivery/me/profile:
 *   put:
 *     summary: Update delivery partner profile
 *     security:
 *       - bearerAuth: []
 *     tags: [Delivery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vehicle_type: { type: string }
 *               vehicle_number: { type: string }
 *               license_number: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.updateProfile(req.user!.id, req.body, req);
  return sendSuccess(res, data, { message: "Profile updated." });
});
