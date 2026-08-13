import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { membershipPlanService } from "../services/membership-plan.service";
import prisma from "../database/prisma";
import asyncHandler from "../utils/asyncHandler";

const PLAN_HIERARCHY = ["basic", "smart", "premium", "business"];

/**
 * The seeded "Free" plan uses the slug "free" while the legacy vendor default
 * tier is "basic". Normalize "free" to "basic" so tier comparisons are stable.
 */
function normalizeTier(tier?: string | null): string {
  const t = tier?.toLowerCase() ?? "basic";
  return t === "free" ? "basic" : t;
}

/**
 * Resolve the plan-tier index for a membership.
 * Uses the fixed hierarchy first, then falls back to the plan's `sort_order`
 * so admin-created plans with custom slugs still compare correctly.
 */
function resolveTierIndex(
  membership: Awaited<ReturnType<typeof membershipPlanService.getMyMembership>>
): number {
  const tier = normalizeTier(membership.tier);
  const index = PLAN_HIERARCHY.indexOf(tier);
  if (index !== -1) return index;
  if (membership.plan?.sort_order != null) return membership.plan.sort_order - 1;
  return -1;
}

/**
 * Middleware to enforce a minimum subscription plan tier.
 */
export const requirePlan = (minPlan: "basic" | "smart" | "premium" | "business") => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "User not authenticated.");
    }

    const vendor = await prisma.vendorProfile.findUnique({
      where: { user_id: req.user.id },
      select: { id: true }
    });

    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor profile not found.");
    }

    const membership = await membershipPlanService.getMyMembership(vendor.id);
    const currentTier = normalizeTier(membership.tier);
    
    if (membership.is_expired && currentTier !== "basic") {
       throw new ApiError(HttpStatus.FORBIDDEN, "Your membership plan has expired. Please renew to access this feature.", {
         code: "MEMBERSHIP_EXPIRED"
       });
    }

    const minPlanIndex = PLAN_HIERARCHY.indexOf(minPlan.toLowerCase());
    const currentPlanIndex = resolveTierIndex(membership);

    if (currentPlanIndex < minPlanIndex) {
      throw new ApiError(HttpStatus.FORBIDDEN, `This feature requires the ${minPlan} plan or higher.`, {
        code: "INSUFFICIENT_PLAN_TIER",
        details: { required_tier: minPlan, current_tier: membership.tier },
      });
    }

    next();
  });
};

/**
 * Middleware to enforce product limit according to the vendor's active plan.
 */
export const checkProductLimit = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, "User not authenticated.");
  }

  const vendor = await prisma.vendorProfile.findUnique({
    where: { user_id: req.user.id },
    select: { id: true }
  });

  if (!vendor) {
    throw new ApiError(HttpStatus.NOT_FOUND, "Vendor profile not found.");
  }

  const membership = await membershipPlanService.getMyMembership(vendor.id);
  const productLimit = membership.plan?.product_limit ?? 10; // Free plan defaults to 10

  // A limit of 0 (or negative) means unlimited products.
  if (productLimit <= 0) {
    return next();
  }

  const currentProductsCount = await prisma.product.count({
    where: { vendor_id: vendor.id, deleted_at: null }
  });

  if (currentProductsCount >= productLimit) {
    throw new ApiError(HttpStatus.FORBIDDEN, `You have reached your product limit of ${productLimit} products for your current plan. Please upgrade to add more products.`, {
      code: "PRODUCT_LIMIT_REACHED"
    });
  }

  next();
});

export const checkVendorDailyOrderLimit = async (vendorId: string) => {
  const membership = await membershipPlanService.getMyMembership(vendorId);

  const orderLimit = membership.plan?.daily_order_limit ?? 5;
  // A limit of 0 (or negative) means unlimited orders per day.
  if (orderLimit <= 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Atomic pre-check: create today's counter row (if missing) then read it under
  // `FOR UPDATE`, so two concurrent checks serialise on the row instead of both
  // passing the old `findUnique` + throw. The authoritative limit is still
  // enforced at checkout by the conditional increment in
  // `dailyOrderCounterRepo.incrementForVendor`; this only rejects up-front
  // without consuming a slot.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO daily_order_counters (id, vendor_id, date, count, created_at, updated_at)
      VALUES (gen_random_uuid(), ${vendorId}::uuid, ${today}::date, 0, now(), now())
      ON CONFLICT (vendor_id, date) DO NOTHING
    `;
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      SELECT count FROM daily_order_counters
      WHERE vendor_id = ${vendorId}::uuid AND date = ${today}::date
      FOR UPDATE
    `;
    const count = rows[0]?.count ?? 0;
    if (count >= orderLimit) {
      throw new ApiError(HttpStatus.FORBIDDEN, `Vendor is currently busy and has reached their daily order limit.`, {
        code: "DAILY_ORDER_LIMIT_REACHED"
      });
    }
  });
};
