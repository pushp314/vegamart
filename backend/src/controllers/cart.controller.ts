import type { Request, Response } from "express";

import { cartService } from "../services/cart.service";
import { sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import type { AddCartItemBody, UpdateCartItemBody } from "../validators/cart.validators";

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get the current user's cart with items
 *     security:
 *       - bearerAuth: []
 *     tags: [Cart]
 *     responses:
 *       200:
 *         description: Cart with line items.
 */
export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getMyCart(req.user!.id);
  return sendSuccess(res, cart);
});

/**
 * @swagger
 * /cart/items:
 *   post:
 *     summary: Add a product to the cart
 *     security:
 *       - bearerAuth: []
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, quantity]
 *             properties:
 *               product_id: { type: string, format: uuid }
 *               quantity: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Updated cart.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const addCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addItem(req.user!.id, req.body as AddCartItemBody, req);
  return sendSuccess(res, cart);
});

/**
 * @swagger
 * /cart/items/{item_id}:
 *   patch:
 *     summary: Update a cart item quantity
 *     security:
 *       - bearerAuth: []
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: item_id
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
 *               quantity: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Updated cart.
 */
export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateItem(req.user!.id, req.params.item_id as string, req.body as UpdateCartItemBody, req);
  return sendSuccess(res, cart);
});

/**
 * @swagger
 * /cart/items/{item_id}:
 *   delete:
 *     summary: Remove an item from the cart
 *     security:
 *       - bearerAuth: []
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated cart.
 */
export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeItem(req.user!.id, req.params.item_id as string, req);
  return sendSuccess(res, cart);
});

/**
 * @swagger
 * /cart:
 *   delete:
 *     summary: Clear the cart
 *     security:
 *       - bearerAuth: []
 *     tags: [Cart]
 *     responses:
 *       204:
 *         description: Cart cleared.
 */
export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  await cartService.clear(req.user!.id, req);
  return sendNoContent(res);
});
