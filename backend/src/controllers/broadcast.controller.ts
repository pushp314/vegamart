import type { Request, Response } from "express";

import prisma from "../database/prisma";
import { ApiError, ForbiddenError, NotFoundError } from "../utils/ApiError";
import { sendCreated, sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { HttpStatus } from "../utils/httpStatus";

/**
 * @swagger
 * /broadcasts:
 *   get:
 *     summary: List active street vendor broadcasts (public)
 *     tags: [Broadcasts]
 *     responses:
 *       200:
 *         description: Active broadcasts.
 */
export const listBroadcasts = asyncHandler(async (_req: Request, res: Response) => {
  const broadcasts = await prisma.broadcast.findMany({
    where: { is_active: true, deleted_at: null },
    orderBy: { created_at: "desc" },
  });
  return sendSuccess(res, broadcasts);
});

/**
 * @swagger
 * /broadcasts:
 *   post:
 *     summary: Create a street vendor broadcast (vendor only)
 *     tags: [Broadcasts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [street, arrival_time, produce]
 *             properties:
 *               street:
 *                 type: string
 *               arrival_time:
 *                 type: string
 *               produce:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created broadcast.
 */
export const createBroadcast = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as {
    street: string;
    arrival_time: string;
    produce: string;
    note?: string | null;
  };

  const vendor = await prisma.vendorProfile.findUnique({
    where: { user_id: req.user!.id },
    select: { id: true, business_name: true, phone: true, roaming: true, deleted_at: true },
  });
  if (!vendor || vendor.deleted_at) {
    throw new NotFoundError("Vendor profile not found.");
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      vendor_id: vendor.id,
      vendor_name: vendor.business_name,
      vendor_type: vendor.roaming ? "ROAMING" : "SHOP",
      phone: vendor.phone ?? null,
      street: data.street,
      arrival_time: data.arrival_time,
      produce: data.produce,
      note: data.note ?? null,
    },
  });

  return sendCreated(res, broadcast, "Broadcast created.");
});

/**
 * @swagger
 * /broadcasts/{id}:
 *   delete:
 *     summary: Delete a street vendor broadcast (owner vendor only)
 *     tags: [Broadcasts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Broadcast deleted.
 *       404:
 *         description: Broadcast not found.
 */
export const deleteBroadcast = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.broadcast.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, vendor_id: true },
  });
  if (!existing) {
    throw new ApiError(HttpStatus.NOT_FOUND, "Broadcast not found.", { code: "NOT_FOUND" });
  }

  const vendor = await prisma.vendorProfile.findUnique({
    where: { user_id: req.user!.id },
    select: { id: true },
  });
  if (!vendor || existing.vendor_id !== vendor.id) {
    throw new ForbiddenError("You do not own this broadcast.");
  }

  await prisma.broadcast.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  });

  return sendNoContent(res);
});
