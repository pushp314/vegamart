import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";
import log from "../config/logger";
import { notificationService } from "../services/notification.service";

export async function cleanupExpiredOtps(): Promise<number> {
  const result = await prisma.otpVerification.deleteMany({
    where: { expires_at: { lt: new Date() }, is_used: false },
  });
  log.info(`[cron] Cleaned up ${result.count} expired OTPs`, { context: "cron" });
  return result.count;
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expires_at: { lt: new Date() }, is_used: false },
  });
  log.info(`[cron] Cleaned up ${result.count} expired password reset tokens`, { context: "cron" });
  return result.count;
}

export async function cleanupExpiredRefreshTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expires_at: { lt: new Date() } },
  });
  log.info(`[cron] Cleaned up ${result.count} expired refresh tokens`, { context: "cron" });
  return result.count;
}

export async function cleanupOldNotifications(retentionDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const result = await prisma.notification.deleteMany({
    where: { created_at: { lt: cutoff } },
  });
  log.info(`[cron] Cleaned up ${result.count} notifications older than ${retentionDays} days`, { context: "cron" });
  return result.count;
}

export async function expireExpiredCoupons(): Promise<number> {
  const result = await prisma.coupon.updateMany({
    where: {
      is_active: true,
      valid_until: { lt: new Date() },
    },
    data: { is_active: false },
  });
  log.info(`[cron] Expired ${result.count} coupons`, { context: "cron" });
  return result.count;
}

export interface DailySalesReport {
  date: string;
  total_orders: number;
  revenue: Prisma.Decimal;
  avg_order_value: Prisma.Decimal;
}

export async function computeDailySalesReport(date: Date): Promise<DailySalesReport> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const agg = await prisma.order.aggregate({
    where: {
      created_at: { gte: start, lt: end },
      status: { notIn: ["CANCELLED", "FAILED"] },
    },
    _count: { _all: true },
    _sum: { total: true },
    _avg: { total: true },
  });

  const report: DailySalesReport = {
    date: start.toISOString(),
    total_orders: agg._count._all,
    revenue: agg._sum.total ?? new Prisma.Decimal(0),
    avg_order_value: agg._avg.total ?? new Prisma.Decimal(0),
  };
  log.info(`[cron] Daily sales report for ${start.toISOString()}: ${report.total_orders} orders, revenue ${report.revenue.toFixed(2)}`, {
    context: "cron",
    report,
  });
  return report;
}

export interface DailyVendorSummary {
  vendor_id: string;
  business_name: string;
  orders: number;
  revenue: Prisma.Decimal;
}

export async function computeDailyVendorSummaries(date: Date): Promise<DailyVendorSummary[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const rows = await prisma.vendorProfile.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      business_name: true,
      orders: {
        where: {
          created_at: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        select: { total: true },
      },
    },
  });

  const summaries = rows.map((vendor) => ({
    vendor_id: vendor.id,
    business_name: vendor.business_name,
    orders: vendor.orders.length,
    revenue: vendor.orders.reduce(
      (sum, order) => sum.plus(order.total),
      new Prisma.Decimal(0)
    ),
  }));

  log.info(`[cron] Computed daily summaries for ${summaries.length} vendors`, { context: "cron" });
  return summaries;
}

export async function cleanupTempFiles(retentionHours: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - retentionHours);
  const candidates = await prisma.auditLog.findMany({
    where: {
      action: "file.uploaded",
      created_at: { lt: cutoff },
    },
    select: { entity_id: true },
    take: 100,
  });
  log.info(`[cron] Found ${candidates.length} uploaded files older than ${retentionHours}h (cleanup is delegated to R2 lifecycle rules)`, {
    context: "cron",
  });
}

export async function expireExpiredMemberships(): Promise<number> {
  const now = new Date();
  
  // Auto-demote vendors whose scheduled promotion duration (sponsored_until) has passed
  const expiredPromotions = await prisma.vendorProfile.findMany({
    where: {
      is_sponsored: true,
      sponsored_until: { lte: now },
    },
    select: { id: true, user_id: true, business_name: true },
  });

  for (const vendor of expiredPromotions) {
    await prisma.vendorProfile.update({
      where: { id: vendor.id },
      data: { is_sponsored: false, sponsored_until: null },
    });
    await notificationService.vendor(
      vendor.user_id,
      "Promotion expired",
      `Your promoted search placement duration has ended.`,
      { vendor_id: vendor.id }
    );
  }

  const expired = await prisma.vendorProfile.findMany({
    where: {
      membership_expires_at: { lte: now },
      membership_plan_id: { not: null },
    },
    select: {
      id: true,
      user_id: true,
      business_name: true,
      membership_plan: { select: { includes_sponsorship: true, name: true } },
    },
  });

  let count = expiredPromotions.length;
  for (const vendor of expired) {
    const demoteSponsorship = vendor.membership_plan?.includes_sponsorship ?? false;
    await prisma.vendorProfile.update({
      where: { id: vendor.id },
      data: {
        membership_tier: "basic",
        membership_plan: { disconnect: true },
        membership_expires_at: null,
        is_sponsored: demoteSponsorship ? false : undefined,
        commission_rate: 5,
      },
    });
    await prisma.vendorSubscription.updateMany({
      where: { vendor_id: vendor.id, status: { notIn: ["canceled", "expired", "completed"] } },
      data: { status: "expired", auto_renew: false },
    });
    await notificationService.vendor(
      vendor.user_id,
      "Membership expired",
      `Your ${vendor.membership_plan?.name ?? ""} plan has expired. Your store has reverted to the basic plan. Renew to keep your premium features.`,
      { vendor_id: vendor.id, plan_id: null, tier: "basic" }
    );
    count += 1;
  }

  if (count > 0) {
    log.info(`[cron] Expired memberships/promotions for ${count} vendors`, { context: "cron" });
  }
  return count;
}

/**
 * Notifies vendors whose membership expires in exactly 7 days or 1 day.
 * Intended to run daily.
 */
export async function remindExpiringMemberships(): Promise<number> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const upcoming = await prisma.vendorProfile.findMany({
    where: {
      membership_plan_id: { not: null },
      membership_expires_at: { gte: now, lte: in7Days },
    },
    select: {
      id: true,
      user_id: true,
      business_name: true,
      membership_expires_at: true,
      membership_plan: { select: { name: true } },
    },
  });

  let count = 0;
  for (const vendor of upcoming) {
    const expiresAt = vendor.membership_expires_at!;
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
    if (daysLeft === 7 || daysLeft === 1) {
      await notificationService.vendor(
        vendor.user_id,
        `Membership expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
        `Your ${vendor.membership_plan?.name ?? ""} plan expires on ${expiresAt.toLocaleDateString()}. Renew now to keep your premium features.`,
        { vendor_id: vendor.id, expires_at: expiresAt.toISOString() }
      );
      count += 1;
    }
  }

  if (count > 0) {
    log.info(`[cron] Sent membership expiry reminders to ${count} vendors`, { context: "cron" });
  }
  return count;
}

/**
 * Hourly Cron: Releases pending escrow earnings older than 24 hours into available balance.
 */
export async function processEscrowReleaseJob(): Promise<{ releasedVendors: number; releasedDelivery: number }> {
  const { releaseEscrowEarnings } = await import("../services/earning.service");
  const result = await releaseEscrowEarnings(24);
  if (result.releasedVendorEarnings > 0 || result.releasedDeliveryEarnings > 0) {
    log.info(
      `[cron] Escrow Release: Transitioned ${result.releasedVendorEarnings} vendor & ${result.releasedDeliveryEarnings} delivery earnings to SETTLED`,
      { context: "cron" }
    );
  }
  return {
    releasedVendors: result.releasedVendorEarnings,
    releasedDelivery: result.releasedDeliveryEarnings,
  };
}

/**
 * Daily Cron: Automatically processes vendor payouts for accounts with available balance above threshold (e.g. ₹500).
 */
export async function processScheduledVendorPayoutsJob(minThreshold = 500): Promise<number> {
  const { payoutService } = await import("../services/payout.service");
  const vendors = await (prisma as any).vendorProfile.findMany({
    where: { payout_enabled: true },
    select: { id: true, business_name: true, user_id: true, bank_account_number: true, upi_id: true },
  });

  let processedCount = 0;
  for (const v of vendors as any[]) {
    if (!v.bank_account_number && !v.upi_id) continue;
    try {
      const overview = await payoutService.getVendorWalletOverview(v.id);
      if (overview.available_balance >= minThreshold) {
        log.info(`[cron] Auto-payout triggered for ${v.business_name}: ₹${overview.available_balance}`);
        await payoutService.requestVendorWithdrawal(v.id, {
          amount: overview.available_balance,
          payout_mode: v.upi_id ? "UPI" : "BANK_TRANSFER",
          notes: `Automated Scheduled Daily Settlement (Balance: ₹${overview.available_balance})`,
        });
        processedCount += 1;
      }
    } catch (err: any) {
      log.warn(`[cron] Auto-payout skipped for vendor ${v.id}: ${err.message}`);
    }
  }

  if (processedCount > 0) {
    log.info(`[cron] Completed automated scheduled payouts for ${processedCount} vendors`, { context: "cron" });
  }
  return processedCount;
}

/**
 * Daily Cron: Automatically processes delivery partner payouts above threshold.
 */
export async function processScheduledDeliveryPayoutsJob(minThreshold = 300): Promise<number> {
  const { deliveryService } = await import("../services/delivery.service");
  const riders = await (prisma as any).deliveryProfile.findMany({
    where: { payout_enabled: true },
    select: { id: true, user_id: true, bank_account_number: true, upi_id: true },
  });

  let processedCount = 0;
  for (const r of riders as any[]) {
    if (!r.bank_account_number && !r.upi_id) continue;
    try {
      const overview = await deliveryService.getDeliveryWalletOverview(r.id);
      if (overview.available_balance >= minThreshold) {
        log.info(`[cron] Rider auto-payout triggered for ${r.id}: ₹${overview.available_balance}`);
        await deliveryService.requestDeliveryWithdrawal(r.id, {
          amount: overview.available_balance,
          payout_mode: r.upi_id ? "UPI" : "BANK_TRANSFER",
          notes: `Automated Scheduled Daily Settlement (Balance: ₹${overview.available_balance})`,
        });
        processedCount += 1;
      }
    } catch (err: any) {
      log.warn(`[cron] Rider auto-payout skipped for partner ${r.id}: ${err.message}`);
    }
  }

  if (processedCount > 0) {
    log.info(`[cron] Completed automated scheduled payouts for ${processedCount} riders`, { context: "cron" });
  }
  return processedCount;
}
