import type { Request, Response } from "express";

import { inventoryService } from "../services/inventory.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: List the vendor's inventory
 *     security:
 *       - bearerAuth: []
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Inventory for the authenticated vendor.
 */
export const listInventory = asyncHandler(async (req: Request, res: Response) => {
  const items = await inventoryService.listForVendor(req.user!.id);
  return sendSuccess(res, items);
});

/**
 * @swagger
 * /inventory/{product_id}:
 *   get:
 *     summary: Get inventory for a product (vendor owner only)
 *     security:
 *       - bearerAuth: []
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inventory record.
 */
export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.getByProductId(req.params.product_id as string, req.user!.id);
  return sendSuccess(res, item);
});

/**
 * @swagger
 * /inventory/{product_id}:
 *   put:
 *     summary: Set inventory quantity for a product
 *     security:
 *       - bearerAuth: []
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 0 }
 *               low_stock_threshold: { type: integer, minimum: 0 }
 *               location: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Inventory updated.
 */
export const setInventory = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { quantity: number; low_stock_threshold?: number; location?: string | null };
  const item = await inventoryService.set(req.params.product_id as string, req.user!.id, body, req);
  return sendSuccess(res, item);
});

/**
 * @swagger
 * /inventory/{product_id}/adjust:
 *   post:
 *     summary: Adjust inventory quantity by a delta (can be negative)
 *     security:
 *       - bearerAuth: []
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [delta]
 *             properties:
 *               delta: { type: integer }
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Inventory adjusted.
 */
export const adjustInventory = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { delta: number; reason?: string };
  const item = await inventoryService.adjust(req.params.product_id as string, req.user!.id, body.delta, body.reason, req);
  return sendSuccess(res, item);
});

/**
 * @swagger
 * /inventory/bulk:
 *   put:
 *     summary: Bulk update inventory quantities
 *     security:
 *       - bearerAuth: []
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_id, quantity]
 *                   properties:
 *                     product_id: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 0 }
 *                     low_stock_threshold: { type: integer }
 *                     location: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Inventory bulk updated.
 */
export const bulkUpdateInventory = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { items: Array<{ product_id: string; quantity: number; low_stock_threshold?: number; location?: string | null }> };
  const items = await inventoryService.bulkSet(req.user!.id, body.items, req);
  return sendSuccess(res, items);
});
