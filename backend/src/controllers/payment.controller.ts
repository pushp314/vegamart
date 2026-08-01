import type { Request, Response } from "express";

import { paymentService } from "../services/payment.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import type { RefundPaymentBody, VerifyPaymentBody } from "../validators/payment.validators";

/**
 * @swagger
 * /payments/verify:
 *   post:
 *     summary: Verify a Razorpay payment signature and confirm the order
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified.
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.verifyPayment(req.user!.id, req.body as VerifyPaymentBody, req);
  return sendSuccess(res, result);
});

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Razorpay webhook endpoint (unauthenticated, signature verified)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed.
 */
export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = (req as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? JSON.stringify(req.body);
  const signature = (req.headers["x-razorpay-signature"] as string) ?? undefined;
  const result = await paymentService.handleWebhook(rawBody, signature, req);
  return sendSuccess(res, result);
});

/**
 * @swagger
 * /payments/{order_id}/refund:
 *   post:
 *     summary: Refund a payment for an order (admin)
 *     security:
 *       - bearerAuth: []
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number, nullable: true }
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Refund processed.
 */
export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.refund(req.user!.id, req.params.order_id as string, req.body as RefundPaymentBody, req);
  return sendSuccess(res, result);
});
