import type { Request, Response } from "express";

import { orderService } from "../services/order.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import type { CancelOrderBody, RequestRefundBody, TransitionOrderStatusBody } from "../validators/order.validators";

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List the current customer's orders
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated order list.
 */
export const listMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { page?: string; per_page?: string; status?: string };
  const result = await orderService.listMyOrders(req.user!.id, {
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    status: query.status,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /orders/{order_id}:
 *   get:
 *     summary: Get an order detail with timeline and payment
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order detail.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderForUser(req.user!.id, req.params.order_id as string);
  return sendSuccess(res, order);
});

/**
 * @swagger
 * /orders/{order_id}/timeline:
 *   get:
 *     summary: Get an order's status timeline
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ordered list of status events.
 */
export const getOrderTimeline = asyncHandler(async (req: Request, res: Response) => {
  await orderService.getOrderForUser(req.user!.id, req.params.order_id as string);
  const events = await orderService.getTimeline(req.params.order_id as string);
  return sendSuccess(res, events);
});

/**
 * @swagger
 * /orders/{order_id}/refund:
 *   post:
 *     summary: Request a refund for a delivered order
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Order marked as REFUNDED.
 *       400:
 *         $ref: "#/components/responses/BadRequest"
 */
export const requestRefund = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RequestRefundBody;
  const result = await orderService.requestRefund(req.user!.id, req.params.order_id as string, body.reason, req);
  return sendSuccess(res, result);
});

/**
 * @swagger
 * /orders/{order_id}/invoice:
 *   get:
 *     summary: Get an order's invoice
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order invoice.
 */
export const getOrderInvoice = asyncHandler(async (req: Request, res: Response) => {
  await orderService.getOrderForUser(req.user!.id, req.params.order_id as string);
  const order = await orderService.getInvoice(req.params.order_id as string);
  return sendSuccess(res, order);
});

/**
 * @swagger
 * /orders/{order_id}/cancel:
 *   post:
 *     summary: Cancel an order (customer, only pending/confirmed)
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
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
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Order cancelled.
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.cancelOrder(req.user!.id, req.params.order_id as string, req.body as CancelOrderBody, req);
  return sendSuccess(res, order);
});

/**
 * @swagger
 * /vendors/orders:
 *   get:
 *     summary: List the vendor's orders
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated vendor order list.
 */
export const listVendorOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { page?: string; per_page?: string; status?: string };
  const result = await orderService.listVendorOrders(req.user!.id, {
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    status: query.status,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /vendors/orders/{order_id}:
 *   get:
 *     summary: Get a vendor's order detail
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order detail.
 */
export const getVendorOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderForVendor(req.user!.id, req.params.order_id as string);
  return sendSuccess(res, order);
});

/**
 * @swagger
 * /vendors/orders/{order_id}/status:
 *   patch:
 *     summary: Advance an order's status (vendor)
 *     security:
 *       - bearerAuth: []
 *     tags: [Orders]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [CONFIRMED, PREPARING, PACKED, READY_FOR_PICKUP, OUT_FOR_DELIVERY, DELIVERED] }
 *               note: { type: string, nullable: true }
 *               otp_code: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Order status updated.
 */
export const transitionOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.transitionStatus(req.user!.id, req.params.order_id as string, req.body as TransitionOrderStatusBody, req);
  return sendSuccess(res, order);
});

export const rejectOrderItem = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.rejectOrderItem(req.user!.id, req.params.order_id!, req.params.item_id!, req);
  return sendSuccess(res, result, { message: "Order item rejected successfully" });
});
