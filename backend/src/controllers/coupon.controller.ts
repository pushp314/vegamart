import type { Request, Response } from "express";

import { couponService } from "../services/coupon.service";
import { cartService } from "../services/cart.service";
import { vendorService } from "../services/vendor.service";
import { sendCreated, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import type { CreateCouponBody, UpdateCouponBody } from "../validators/coupon.validators";

/**
 * @swagger
 * /coupons:
 *   get:
 *     summary: List coupons (admin)
 *     security:
 *       - bearerAuth: []
 *     tags: [Coupons]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: is_active
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PERCENTAGE, FIXED, FREE_DELIVERY] }
 *     responses:
 *       200:
 *         description: Paginated coupon list.
 */
export const listCoupons = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const result = await couponService.listAdmin({
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    is_active: query.is_active,
    q: query.q,
    type: query.type,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /coupons/available:
 *   get:
 *     summary: List available active coupons (customer)
 *     security:
 *       - bearerAuth: []
 *     tags: [Coupons]
 */
export const listAvailableCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const result = await couponService.listAdmin({
    is_active: "true",
    per_page: 20,
  });
  return sendSuccess(res, result.rows.map(c => ({
    code: c.code,
    desc: c.type === "PERCENTAGE" ? `Flat ${Number(c.value)}% OFF` : c.type === "FIXED" ? `Flat ₹${Number(c.value)} OFF` : "Free Delivery",
  })));
});

/**
 * @swagger
 * /coupons:
 *   post:
 *     summary: Create a coupon (admin)
 *     security:
 *       - bearerAuth: []
 *     tags: [Coupons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, type, value, valid_from, valid_until]
 *             properties:
 *               code: { type: string }
 *               type: { type: string, enum: [PERCENTAGE, FIXED, FREE_DELIVERY] }
 *               value: { type: number }
 *               max_discount: { type: number, nullable: true }
 *               min_order_value: { type: number, nullable: true }
 *               usage_limit: { type: integer, default: 0 }
 *               per_user_limit: { type: integer, default: 1 }
 *               valid_from: { type: string, format: date-time }
 *               valid_until: { type: string, format: date-time }
 *               is_active: { type: boolean, default: true }
 *               applies_to_vendor_ids: { type: array, items: { type: string, format: uuid } }
 *               applies_to_product_ids: { type: array, items: { type: string, format: uuid } }
 *               applies_to_category_ids: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: Coupon created.
 */
export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.create(req.body as CreateCouponBody, req);
  return sendCreated(res, coupon);
});

/**
 * @swagger
 * /coupons/{coupon_id}:
 *   patch:
 *     summary: Update a coupon (admin)
 *     security:
 *       - bearerAuth: []
 *     tags: [Coupons]
 *     parameters:
 *       - in: path
 *         name: coupon_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Coupon updated.
 */
export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.update(req.params.coupon_id as string, req.body as UpdateCouponBody, req);
  return sendSuccess(res, coupon);
});

/**
 * @swagger
 * /coupons/{coupon_id}:
 *   delete:
 *     summary: Soft-delete a coupon (admin)
 *     security:
 *       - bearerAuth: []
 *     tags: [Coupons]
 *     parameters:
 *       - in: path
 *         name: coupon_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Coupon deleted.
 */
export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  await couponService.remove(req.params.coupon_id as string, req);
  return sendSuccess(res, { deleted: true });
});

/**
 * @swagger
 * /vendors/me/coupons:
 *   get:
 *     summary: List the vendor's own coupons (Business tier)
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendor Coupons]
 */
export const listVendorCoupons = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getMyVendor(req.user!.id);
  const query = req.query as Record<string, string | undefined>;
  const result = await couponService.listVendor(vendor.id, {
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    is_active: query.is_active,
    q: query.q,
    type: query.type,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /vendors/me/coupons:
 *   post:
 *     summary: Create a coupon scoped to the vendor (Business tier)
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendor Coupons]
 */
export const createVendorCoupon = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getMyVendor(req.user!.id);
  const coupon = await couponService.createForVendor(vendor.id, req.body as CreateCouponBody, req);
  return sendCreated(res, coupon);
});

/**
 * @swagger
 * /vendors/me/coupons/{coupon_id}:
 *   patch:
 *     summary: Update one of the vendor's own coupons (Business tier)
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendor Coupons]
 */
export const updateVendorCoupon = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getMyVendor(req.user!.id);
  const coupon = await couponService.updateForVendor(vendor.id, req.params.coupon_id as string, req.body as UpdateCouponBody, req);
  return sendSuccess(res, coupon);
});

/**
 * @swagger
 * /vendors/me/coupons/{coupon_id}:
 *   delete:
 *     summary: Delete one of the vendor's own coupons (Business tier)
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendor Coupons]
 */
export const deleteVendorCoupon = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getMyVendor(req.user!.id);
  await couponService.removeForVendor(vendor.id, req.params.coupon_id as string, req);
  return sendSuccess(res, { deleted: true });
});

/**
 * @swagger
 * /coupons/validate:
 *   post:
 *     summary: Validate a coupon code against the current cart
 *     security:
 *       - bearerAuth: []
 *     tags: [Coupons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Coupon validated with the computed discount.
 */
export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, items } = req.body as { code: string; items?: Array<{ product_id: string; quantity: number }> };
  const result = items
    ? await couponService.validateForItems(code, items, req.user!.id)
    : await couponService.validateForCart(code, await cartService.getMyCart(req.user!.id), req.user!.id);
  return sendSuccess(res, {
    code: result.coupon.code,
    coupon_id: result.coupon.id,
    type: result.coupon.type,
    discount: result.discount,
    valid: true,
  });
});
