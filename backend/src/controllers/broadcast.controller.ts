import type { Request, Response } from "express";

import prisma from "../database/prisma";
import { ApiError } from "../utils/ApiError";
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
 *     summary: Create a street vendor broadcast (public)
 *     tags: [Broadcasts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendor_name, vendor_type, street, arrival_time, produce]
 *             properties:
 *               vendor_id:
 *                 type: string
 *                 format: uuid
 *               vendor_name:
 *                 type: string
 *               vendor_type:
 *                 type: string
 *                 enum: [roaming, shop]
 *               phone:
 *                 type: string
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
    vendor_id?: string | null;
    vendor_name: string;
    vendor_type: "roaming" | "shop";
    phone?: string | null;
    street: string;
    arrival_time: string;
    produce: string;
    note?: string | null;
  };

  let vendorId: string | null = null;
  if (data.vendor_id) {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: data.vendor_id },
      select: { id: true },
    });
    if (vendor) vendorId = vendor.id;
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      vendor_id: vendorId,
      vendor_name: data.vendor_name,
      vendor_type: data.vendor_type === "shop" ? "SHOP" : "ROAMING",
      phone: data.phone ?? null,
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
 *     summary: Delete a street vendor broadcast (public)
 *     tags: [Broadcasts]
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
    select: { id: true },
  });
  if (!existing) {
    throw new ApiError(HttpStatus.NOT_FOUND, "Broadcast not found.", { code: "NOT_FOUND" });
  }

  await prisma.broadcast.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  });

  return sendNoContent(res);
});
