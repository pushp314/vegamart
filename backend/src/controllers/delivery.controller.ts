import type { Request, Response } from "express";

import { deliveryService } from "../services/delivery.service";
import { sendSuccess, sendCreated } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import type { DeliveryRegisterBody, DeliveryApplyBody, DeliveryOrderStatusBody, DeliveryLocationBody, DeliveredOtpBody, DeliveryKycBody } from "../validators/integration.validators";

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
  return sendSuccess(res, await deliveryService.updateProfile(req.user!.id, req.body as Record<string, unknown>, req));
});

export const registerDelivery = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.registerDelivery(req.user!.id, req.body as DeliveryRegisterBody, req);
  return sendCreated(res, data, "Delivery partner application submitted.");
});

export const applyDelivery = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.applyDelivery(req.user!.id, req.body as DeliveryApplyBody, req);
  return sendCreated(res, data, "Delivery partner application submitted.");
});

export const getDeliveryMe = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await deliveryService.getDeliveryMe(req.user!.id));
});

export const listDeliveryRequests = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await deliveryService.listDeliveryRequests());
});

export const listMyDeliveries = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await deliveryService.listMyDeliveries(req.user!.id));
});

export const acceptDelivery = asyncHandler(async (req: Request, res: Response) => {
  const { eta_minutes } = req.body as { eta_minutes: number };
  const data = await deliveryService.acceptDelivery(req.user!.id, req.params.id as string, eta_minutes, req);
  return sendSuccess(res, data, { message: "Delivery accepted." });
});

export const updateDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.updateDeliveryStatus(
    req.user!.id,
    req.params.id as string,
    req.body as DeliveryOrderStatusBody
  );
  return sendSuccess(res, data, { message: "Delivery status updated." });
});

export const updateDeliveryLocation = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.updateDeliveryLocation(req.user!.id, req.body as DeliveryLocationBody);
  return sendSuccess(res, data, { message: "Location updated." });
});

export const markDelivered = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.markDelivered(req.user!.id, req.params.id as string, req.body as DeliveredOtpBody);
  return sendSuccess(res, data, { message: "Order marked as delivered." });
});

export const submitDeliveryKyc = asyncHandler(async (req: Request, res: Response) => {
  const data = await deliveryService.submitDeliveryKyc(req.user!.id, req.body as DeliveryKycBody, req);
  return sendCreated(res, data, "Documents submitted.");
});

export const getDeliveryTracking = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await deliveryService.getDeliveryTracking(req.user!, req.params.id as string));
});

export const getDeliveryWallet = asyncHandler(async (req: Request, res: Response) => {
  const profile = await deliveryService.getDeliveryMe(req.user!.id);
  if (!profile) throw new Error("Delivery profile not found");
  const wallet = await deliveryService.getDeliveryWalletOverview(profile.id);
  return sendSuccess(res, wallet);
});

export const requestDeliveryWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const profile = await deliveryService.getDeliveryMe(req.user!.id);
  if (!profile) throw new Error("Delivery profile not found");
  const result = await deliveryService.requestDeliveryWithdrawal(profile.id, req.body);
  return sendSuccess(res, result, { message: result.message });
});

export const updateDeliveryBankDetails = asyncHandler(async (req: Request, res: Response) => {
  const profile = await deliveryService.getDeliveryMe(req.user!.id);
  if (!profile) throw new Error("Delivery profile not found");
  const updated = await deliveryService.updateDeliveryBankDetails(profile.id, req.body);
  return sendSuccess(res, updated, { message: "Bank and UPI details updated successfully." });
});

export const exportDeliveryWalletStatement = asyncHandler(async (req: Request, res: Response) => {
  const profile = await deliveryService.getDeliveryMe(req.user!.id);
  if (!profile) throw new Error("Delivery profile not found");
  const csv = await deliveryService.exportDeliveryWalletStatementCsv(profile.id);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=rider-statement-${profile.id.slice(0, 8)}.csv`);
  return res.send(csv);
});

export const verifyDeliveryUpi = asyncHandler(async (req: Request, res: Response) => {
  const { payoutService } = await import("../services/payout.service");
  const upiId = (req.body?.upi_id || req.query?.upi_id || "").toString().trim();
  if (!upiId) return sendSuccess(res, { valid: false, message: "Please provide a valid UPI ID." });
  const result = await payoutService.verifyVendorUpi(upiId);
  return sendSuccess(res, result);
});

export const verifyDeliveryBank = asyncHandler(async (req: Request, res: Response) => {
  const { payoutService } = await import("../services/payout.service");
  const { account_number, ifsc, name } = req.body || {};
  if (!account_number || !ifsc) {
    return sendSuccess(res, { valid: false, message: "Account number and IFSC code are required." });
  }
  const result = await payoutService.verifyVendorBank({
    accountNumber: String(account_number),
    ifsc: String(ifsc),
    name: name ? String(name) : undefined,
  });
  return sendSuccess(res, result);
});
