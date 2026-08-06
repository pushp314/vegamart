import type { Request, Response } from "express";

import { membershipPlanService } from "../services/membership-plan.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

export const listPublicMembershipPlans = asyncHandler(async (_req: Request, res: Response) => {
  const plans = await membershipPlanService.listPlans(false);
  return sendSuccess(res, plans);
});
