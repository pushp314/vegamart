import type { Request, Response } from "express";

import { checkoutService } from "../services/checkout.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import type { CheckoutPreviewBody, PlaceOrderBody } from "../validators/checkout.validators";

/**
 * @swagger
 * /checkout/preview:
 *   post:
 *     summary: Preview order totals with optional coupon
 *     security:
 *       - bearerAuth: []
 *     tags: [Checkout]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coupon_code: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Order summary grouped by vendor.
 */
export const previewCheckout = asyncHandler(async (req: Request, res: Response) => {
  const summary = await checkoutService.preview(req.user!.id, req.body as CheckoutPreviewBody, req);
  return sendSuccess(res, summary);
});

/**
 * @swagger
 * /checkout:
 *   post:
 *     summary: Place an order (creates orders + payment intents)
 *     security:
 *       - bearerAuth: []
 *     tags: [Checkout]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address_id]
 *             properties:
 *               address_id: { type: string, format: uuid }
 *               coupon_code: { type: string, nullable: true }
 *               payment_method: { type: string, enum: [RAZORPAY, COD], default: RAZORPAY }
 *               idempotency_key: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Orders placed.
 */
export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await checkoutService.placeOrder(req.user!.id, req.body as PlaceOrderBody, req);
  return sendSuccess(res, result, { status: 201 });
});
