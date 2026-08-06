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

  let count = 0;
  for (const vendor of expired) {
    const demoteSponsorship = vendor.membership_plan?.includes_sponsorship ?? false;
    await prisma.vendorProfile.update({
      where: { id: vendor.id },
      data: {
        is_sponsored: demoteSponsorship ? false : undefined,
        commission_rate: 5,
      },
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
    log.info(`[cron] Expired memberships for ${count} vendors`, { context: "cron" });
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
