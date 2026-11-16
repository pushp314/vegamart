import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { adminRazorpayService } from "../services/admin-razorpay.service";
import { HttpStatus } from "../utils/httpStatus";

export const getRazorpayOverview = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminRazorpayService.getOverview();
  res.status(HttpStatus.OK).json({
    success: true,
    data,
  });
});

export const listRazorpaySettlements = asyncHandler(async (req: Request, res: Response) => {
  const count = req.query.count ? Number(req.query.count) : 50;
  const skip = req.query.skip ? Number(req.query.skip) : 0;
  const data = await adminRazorpayService.listSettlements({ count, skip });
  res.status(HttpStatus.OK).json({
    success: true,
    data,
  });
});

export const listRazorpayPayments = asyncHandler(async (req: Request, res: Response) => {
  const count = req.query.count ? Number(req.query.count) : 50;
  const skip = req.query.skip ? Number(req.query.skip) : 0;
  const data = await adminRazorpayService.listPayments({ count, skip });
  res.status(HttpStatus.OK).json({
    success: true,
    data,
  });
});

export const triggerRazorpaySettlement = asyncHandler(async (req: Request, res: Response) => {
  const { amount, settle_full_balance } = req.body || {};
  const data = await adminRazorpayService.triggerInstantSettlement({
    amount: amount ? Number(amount) : undefined,
    settle_full_balance: Boolean(settle_full_balance),
  });
  res.status(HttpStatus.OK).json({
    success: true,
    message: "Settlement request submitted to Razorpay",
    data,
  });
});
