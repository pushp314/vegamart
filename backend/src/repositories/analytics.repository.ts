import { OrderStatus, Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export interface DateRange {
  from: Date;
  to: Date;
}

const REVENUE_STATUSES = { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED] };

export interface TopProduct {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: Prisma.Decimal;
  vendor_id: string;
  vendor_name: string;
}

export async function topProducts(range: DateRange, limit = 10): Promise<TopProduct[]> {
  const rows = await prisma.$queryRaw<Array<{
    product_id: string;
    product_name: string;
    units_sold: bigint;
    revenue: Prisma.Decimal;
    vendor_id: string;
    vendor_name: string;
  }>>(
    Prisma.sql`
      SELECT
        oi."product_id",
        oi."product_name",
        SUM(oi."quantity") AS units_sold,
        SUM(oi."total_price") AS revenue,
        o."vendor_id",
        v."business_name" AS vendor_name
      FROM order_items oi
      JOIN orders o ON o."id" = oi."order_id"
      JOIN vendor_profiles v ON v."id" = o."vendor_id"
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY oi."product_id", oi."product_name", o."vendor_id", v."business_name"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `
  );
  return rows.map((r) => ({
    product_id: r.product_id,
    product_name: r.product_name,
    units_sold: Number(r.units_sold),
    revenue: new Prisma.Decimal(r.revenue.toString()),
    vendor_id: r.vendor_id,
    vendor_name: r.vendor_name,
  }));
}

export interface TopVendor {
  vendor_id: string;
  business_name: string;
  orders: number;
  revenue: Prisma.Decimal;
}

export async function topVendors(range: DateRange, limit = 10): Promise<TopVendor[]> {
  const rows = await prisma.$queryRaw<Array<{
    vendor_id: string;
    business_name: string;
    orders: bigint;
    revenue: Prisma.Decimal;
  }>>(
    Prisma.sql`
      SELECT
        v."id" AS vendor_id,
        v."business_name",
        COUNT(o."id") AS orders,
        COALESCE(SUM(o."total"), 0) AS revenue
      FROM vendor_profiles v
      JOIN orders o ON o."vendor_id" = v."id"
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY v."id", v."business_name"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `
  );
  return rows.map((r) => ({
    vendor_id: r.vendor_id,
    business_name: r.business_name,
    orders: Number(r.orders),
    revenue: new Prisma.Decimal(r.revenue.toString()),
  }));
}

export interface TopCustomer {
  user_id: string;
  name: string;
  email: string;
  orders: number;
  spend: Prisma.Decimal;
}

export async function topCustomers(range: DateRange, limit = 10): Promise<TopCustomer[]> {
  const rows = await prisma.$queryRaw<Array<{
    user_id: string;
    name: string;
    email: string;
    orders: bigint;
    spend: Prisma.Decimal;
  }>>(
    Prisma.sql`
      SELECT
        u."id" AS user_id,
        u."name",
        u."email",
        COUNT(o."id") AS orders,
        COALESCE(SUM(o."total"), 0) AS spend
      FROM users u
      JOIN orders o ON o."user_id" = u."id"
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY u."id", u."name", u."email"
      ORDER BY spend DESC
      LIMIT ${limit}
    `
  );
  return rows.map((r) => ({
    user_id: r.user_id,
    name: r.name,
    email: r.email,
    orders: Number(r.orders),
    spend: new Prisma.Decimal(r.spend.toString()),
  }));
}

export interface CategorySales {
  category_id: string;
  category_name: string;
  orders: number;
  units_sold: number;
  revenue: Prisma.Decimal;
}

export async function categorySales(range: DateRange): Promise<CategorySales[]> {
  const rows = await prisma.$queryRaw<Array<{
    category_id: string | null;
    category_name: string;
    orders: bigint;
    units_sold: bigint;
    revenue: Prisma.Decimal;
  }>>(
    Prisma.sql`
      SELECT
        c."id" AS category_id,
        COALESCE(c."name", 'Uncategorized') AS category_name,
        COUNT(DISTINCT o."id") AS orders,
        SUM(oi."quantity") AS units_sold,
        SUM(oi."total_price") AS revenue
      FROM order_items oi
      JOIN orders o ON o."id" = oi."order_id"
      LEFT JOIN products p ON p."id" = oi."product_id"
      LEFT JOIN categories c ON c."id" = p."category_id"
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY c."id", c."name"
      ORDER BY revenue DESC
    `
  );
  return rows.map((r) => ({
    category_id: r.category_id ?? "",
    category_name: r.category_name,
    orders: Number(r.orders),
    units_sold: Number(r.units_sold),
    revenue: new Prisma.Decimal(r.revenue.toString()),
  }));
}

export interface TrendPoint {
  period_start: Date;
  orders: number;
  revenue: Prisma.Decimal;
}

export async function orderTrend(range: DateRange): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ period_start: Date; orders: bigint; revenue: Prisma.Decimal }>>(
    Prisma.sql`
      SELECT
        date_trunc('day', o."created_at") AS period_start,
        COUNT(*) AS orders,
        COALESCE(SUM(o."total"), 0) AS revenue
      FROM orders o
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY date_trunc('day', o."created_at")
      ORDER BY period_start ASC
    `
  );
  return rows.map((r) => ({
    period_start: r.period_start,
    orders: Number(r.orders),
    revenue: new Prisma.Decimal(r.revenue.toString()),
  }));
}

export interface GrowthMetrics {
  current: {
    orders: number;
    revenue: Prisma.Decimal;
    new_users: number;
  };
  previous: {
    orders: number;
    revenue: Prisma.Decimal;
    new_users: number;
  };
  order_growth_percent: number;
  revenue_growth_percent: number;
  user_growth_percent: number;
}

function percentGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export async function growthMetrics(current: DateRange, previous: DateRange): Promise<GrowthMetrics> {
  const [currentOrders, currentRevenueAgg, currentUsers, previousOrders, previousRevenueAgg, previousUsers] =
    await Promise.all([
      prisma.order.count({
        where: { created_at: { gte: current.from, lt: current.to }, status: REVENUE_STATUSES, deleted_at: null },
      }),
      prisma.order.aggregate({
        where: { created_at: { gte: current.from, lt: current.to }, status: REVENUE_STATUSES, deleted_at: null },
        _sum: { total: true },
      }),
      prisma.user.count({ where: { created_at: { gte: current.from, lt: current.to }, deleted_at: null } }),
      prisma.order.count({
        where: { created_at: { gte: previous.from, lt: previous.to }, status: REVENUE_STATUSES, deleted_at: null },
      }),
      prisma.order.aggregate({
        where: { created_at: { gte: previous.from, lt: previous.to }, status: REVENUE_STATUSES, deleted_at: null },
        _sum: { total: true },
      }),
      prisma.user.count({ where: { created_at: { gte: previous.from, lt: previous.to }, deleted_at: null } }),
    ]);

  const currentRevenue = currentRevenueAgg._sum?.total ?? new Prisma.Decimal(0);
  const previousRevenue = previousRevenueAgg._sum?.total ?? new Prisma.Decimal(0);

  return {
    current: { orders: currentOrders, revenue: currentRevenue, new_users: currentUsers },
    previous: { orders: previousOrders, revenue: previousRevenue, new_users: previousUsers },
    order_growth_percent: percentGrowth(currentOrders, previousOrders),
    revenue_growth_percent: previousRevenue.isZero()
      ? currentRevenue.greaterThan(0)
        ? 100
        : 0
      : Number(currentRevenue.minus(previousRevenue).div(previousRevenue).mul(100)),
    user_growth_percent: percentGrowth(currentUsers, previousUsers),
  };
}
