import type { Request, Response } from "express";

import { wishlistService } from "../services/wishlist.service";
import { sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import type { AddWishlistItemBody } from "../validators/wishlist.validators";

/**
 * @swagger
 * /wishlist:
 *   get:
 *     summary: List the current user's wishlist
 *     security:
 *       - bearerAuth: []
 *     tags: [Wishlist]
 *     responses:
 *       200:
 *         description: Wishlist items with product details.
 */
export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const items = await wishlistService.list(req.user!.id);
  return sendSuccess(res, items);
});

/**
 * @swagger
 * /wishlist:
 *   post:
 *     summary: Add a product to the wishlist
 *     security:
 *       - bearerAuth: []
 *     tags: [Wishlist]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id]
 *             properties:
 *               product_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Wishlist item added.
 *       409:
 *         description: Already in wishlist.
 */
export const addWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await wishlistService.add(req.user!.id, (req.body as AddWishlistItemBody).product_id, req);
  return sendSuccess(res, item);
});

/**
 * @swagger
 * /wishlist/{product_id}:
 *   delete:
 *     summary: Remove a product from the wishlist
 *     security:
 *       - bearerAuth: []
 *     tags: [Wishlist]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Wishlist item removed.
 */
export const removeWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  await wishlistService.remove(req.user!.id, req.params.product_id as string, req);
  return sendNoContent(res);
});
