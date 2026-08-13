import { Prisma } from "@prisma/client";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    order: { count: jest.fn(), aggregate: jest.fn() },
    vendorEarning: { aggregate: jest.fn() },
    product: { count: jest.fn() },
  },
}));

import prisma from "../../src/database/prisma";
import { getVendorStats } from "../../src/repositories/vendor.repository";

const db = prisma as jest.Mocked<typeof prisma>;

const zeroSum = { _sum: { total: null, items_subtotal: null, discount: null } };
const zeroEarning = { _sum: { amount: null } };

function aggregateCalls() {
  return (db.order.aggregate as jest.Mock).mock.calls.map((c) => c[0]);
}

function withCreatedAt(where: { created_at?: { gte?: Date; lte?: Date } }) {
  return where.created_at ?? {};
}

describe("getVendorStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.order.count as jest.Mock).mockResolvedValue(0);
    (db.order.aggregate as jest.Mock).mockResolvedValue(zeroSum);
    (db.vendorEarning.aggregate as jest.Mock).mockResolvedValue(zeroEarning);
    (db.product.count as jest.Mock).mockResolvedValue(0);
  });

  it("uses today's and this week's windows for the today/weekly aggregates", async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

    await getVendorStats("v1");

    const revenueAggs = aggregateCalls().filter(
      (a) => a._sum && a._sum.total === true && a.where.created_at
    );

    const todayWhere = revenueAggs[0].where.created_at;
    const weeklyWhere = revenueAggs[1].where.created_at;

    expect(todayWhere.gte.getTime()).toBe(startOfToday.getTime());
    expect(weeklyWhere.gte.getTime()).toBe(startOfWeek.getTime());
    expect(Math.abs(todayWhere.lte.getTime() - now.getTime())).toBeLessThan(1000);
  });

  it("applies the month filter to the monthly aggregate only", async () => {
    await getVendorStats("v1", "2026-07");

    const revenueAggs = aggregateCalls().filter(
      (a) => a._sum && a._sum.total === true && a.where.created_at
    );

    // today / weekly windows are untouched by the month filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const todayWhere = withCreatedAt(revenueAggs[0].where);
    const weeklyWhere = withCreatedAt(revenueAggs[1].where);
    const monthlyWhere = withCreatedAt(revenueAggs[2].where);

    expect(todayWhere.gte!.getTime()).toBe(startOfToday.getTime());
    expect(weeklyWhere.gte!.getTime()).toBe(startOfWeek.getTime());

    // the monthly window is July 2026 (whole month, end-of-day bound)
    expect(monthlyWhere.gte!.getFullYear()).toBe(2026);
    expect(monthlyWhere.gte!.getMonth()).toBe(6); // July
    expect(monthlyWhere.gte!.getDate()).toBe(1);
    expect(monthlyWhere.lte!.getFullYear()).toBe(2026);
    expect(monthlyWhere.lte!.getMonth()).toBe(6);
    expect(monthlyWhere.lte!.getDate()).toBe(31);
    expect(monthlyWhere.lte!.getHours()).toBe(23);
    expect(monthlyWhere.lte!.getMinutes()).toBe(59);
    expect(monthlyWhere.lte!.getSeconds()).toBe(59);
  });

  it("returns Decimal fields coerced to numbers when summed", async () => {
    (db.order.aggregate as jest.Mock).mockImplementation(({ _sum }: { _sum: { total?: boolean } }) => {
      if (_sum.total) {
        return Promise.resolve({ _sum: { total: new Prisma.Decimal(250) } });
      }
      return Promise.resolve({ _sum: { items_subtotal: new Prisma.Decimal(300), discount: new Prisma.Decimal(20) } });
    });
    (db.vendorEarning.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: new Prisma.Decimal(210) } });

    const stats = await getVendorStats("v1");

    expect(stats.total_revenue.toNumber()).toBe(250);
    expect(stats.today_revenue.toNumber()).toBe(250);
    expect(stats.item_revenue.toNumber()).toBe(280);
    expect(stats.total_earnings.toNumber()).toBe(210);
  });
});
