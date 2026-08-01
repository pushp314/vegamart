import { Prisma } from "@prisma/client";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    otpVerification: { deleteMany: jest.fn() },
    passwordResetToken: { deleteMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    notification: { deleteMany: jest.fn() },
    coupon: { updateMany: jest.fn() },
    order: { aggregate: jest.fn() },
    vendorProfile: { findMany: jest.fn() },
    auditLog: { findMany: jest.fn() },
  },
}));

import prisma from "../../src/database/prisma";
import {
  cleanupExpiredOtps,
  cleanupExpiredRefreshTokens,
  cleanupExpiredTokens,
  cleanupOldNotifications,
  computeDailySalesReport,
  computeDailyVendorSummaries,
  expireExpiredCoupons,
} from "../../src/jobs/job-tasks";

const db = prisma as unknown as {
  otpVerification: { deleteMany: jest.Mock };
  passwordResetToken: { deleteMany: jest.Mock };
  refreshToken: { deleteMany: jest.Mock };
  notification: { deleteMany: jest.Mock };
  coupon: { updateMany: jest.Mock };
  order: { aggregate: jest.Mock };
  vendorProfile: { findMany: jest.Mock };
  auditLog: { findMany: jest.Mock };
};

describe("background jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes expired unused OTPs", async () => {
    db.otpVerification.deleteMany.mockResolvedValue({ count: 3 } as any);
    await expect(cleanupExpiredOtps()).resolves.toBe(3);
  });

  it("deletes expired unused password reset tokens", async () => {
    db.passwordResetToken.deleteMany.mockResolvedValue({ count: 2 } as any);
    await expect(cleanupExpiredTokens()).resolves.toBe(2);
  });

  it("deletes expired refresh tokens", async () => {
    db.refreshToken.deleteMany.mockResolvedValue({ count: 5 } as any);
    await expect(cleanupExpiredRefreshTokens()).resolves.toBe(5);
  });

  it("deletes notifications older than the retention window", async () => {
    db.notification.deleteMany.mockResolvedValue({ count: 10 } as any);
    await cleanupOldNotifications(90);
    expect(db.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ created_at: { lt: expect.any(Date) } }),
    });
  });

  it("deactivates coupons that have lapsed", async () => {
    db.coupon.updateMany.mockResolvedValue({ count: 4 } as any);
    await expect(expireExpiredCoupons()).resolves.toBe(4);
    expect(db.coupon.updateMany).toHaveBeenCalledWith({
      where: { is_active: true, valid_until: { lt: expect.any(Date) } },
      data: { is_active: false },
    });
  });

  it("computes a daily sales report", async () => {
    db.order.aggregate.mockResolvedValue({
      _count: { _all: 6 },
      _sum: { total: new Prisma.Decimal(1200) },
      _avg: { total: new Prisma.Decimal(200) },
    } as any);

    const report = await computeDailySalesReport(new Date("2026-08-01T12:00:00Z"));
    expect(report.total_orders).toBe(6);
    expect(report.revenue.toNumber()).toBe(1200);
    expect(report.avg_order_value.toNumber()).toBe(200);
  });

  it("computes daily vendor summaries with revenue totals", async () => {
    db.vendorProfile.findMany.mockResolvedValue([
      {
        id: "v1",
        business_name: "Sharma Store",
        orders: [{ total: new Prisma.Decimal(100) }, { total: new Prisma.Decimal(50) }],
      },
      { id: "v2", business_name: "Green Cart", orders: [] },
    ] as any);

    const summaries = await computeDailyVendorSummaries(new Date("2026-08-01T12:00:00Z"));
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({ vendor_id: "v1", orders: 2 });
    expect(summaries[0]!.revenue.toNumber()).toBe(150);
    expect(summaries[1]).toMatchObject({ vendor_id: "v2", orders: 0 });
    expect(summaries[1]!.revenue.toNumber()).toBe(0);
  });
});
