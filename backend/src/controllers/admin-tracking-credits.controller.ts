import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import { sendSuccess } from "../utils/ApiResponse";
import { trackingCreditService } from "../services/tracking-credit.service";

export const getTrackingWallet = asyncHandler(async (_req: Request, res: Response) => {
  const result = await trackingCreditService.listUsageLogs({ page: 1, per_page: 1 });
  return sendSuccess(res, result.wallet, { message: "Tracking wallet retrieved successfully." });
});

export const getTrackingUsageLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const per_page = parseInt(req.query.per_page as string, 10) || 20;
  const search = (req.query.search as string) || undefined;

  const result = await trackingCreditService.listUsageLogs({ page, per_page, search });
  return sendSuccess(res, result, { message: "Tracking usage logs retrieved successfully." });
});

export const addTrackingCredits = asyncHandler(async (req: Request, res: Response) => {
  const amount = parseInt(req.body.amount, 10);
  const reason = req.body.reason || "Admin Credit Recharge";

  const result = await trackingCreditService.addCredits(amount, reason);
  return sendSuccess(res, result, { message: `Successfully added ${amount} tracking credits.` });
});
