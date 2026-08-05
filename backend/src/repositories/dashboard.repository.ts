import { OrderStatus, Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export interface DashboardMetrics {
  total_users: number;
  total_customers: number;
  total_vendors: number;
  total_delivery_partners: number;
  total_products: number;
  total_categories: number;
  total_orders: number;
  total_revenue: Prisma.Decimal;
  total_gmv: Prisma.Decimal;
  avg_order_value: Prisma.Decimal;
  today_orders: number;
  today_revenue: Prisma.Decimal;
  pending_orders: number;
  pending_vendors: number;
  pending_delivery_partners: number;
  active_vendors: number;
  active_users: number;
  new_users_30d: number;
  new_orders_30d: number;
  low_stock_products: number;
}

const REVENUE_STATUSES = { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED] };

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    totalCustomers,
    totalVendors,
    totalDeliveryPartners,
    totalProducts,
    totalCategories,
    totalOrders,
    totalRevenueAgg,
    todayOrders,
    todayRevenueAgg,
    pendingOrders,
    pendingVendors,
    pendingDeliveryPartners,
    activeVendors,
    activeUsers,
    newUsers30d,
    newOrders30d,
    lowStockProducts,
  ] = await Promise.all([
    prisma.user.count({ where: { deleted_at: null } }),
    prisma.user.count({ where: { deleted_at: null, role: { slug: "customer" } } }),
    prisma.vendorProfile.count({ where: { deleted_at: null } }),
    prisma.deliveryProfile.count({ where: { deleted_at: null } }),
    prisma.product.count({ where: { deleted_at: null } }),
    prisma.category.count({ where: { deleted_at: null } }),
    prisma.order.count({ where: { deleted_at: null } }),
    prisma.order.aggregate({
      where: { deleted_at: null, status: REVENUE_STATUSES },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { deleted_at: null, created_at: { gte: startOfDay } } }),
    prisma.order.aggregate({
      where: { deleted_at: null, created_at: { gte: startOfDay }, status: REVENUE_STATUSES },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { deleted_at: null, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.vendorProfile.count({ where: { deleted_at: null, status: "PENDING" } }),
    prisma.deliveryProfile.count({ where: { deleted_at: null, status: "PENDING" } }),
    prisma.vendorProfile.count({ where: { deleted_at: null, status: "APPROVED" } }),
    prisma.user.count({ where: { deleted_at: null, status: "ACTIVE" } }),
    prisma.user.count({ where: { deleted_at: null, created_at: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { deleted_at: null, created_at: { gte: thirtyDaysAgo } } }),
    prisma.product.count({
      where: {
        deleted_at: null,
        is_active: true,
        inventory: { some: { quantity: { lte: 5 } } },
      },
    }),
  ]);

  const totalRevenue = totalRevenueAgg._sum?.total ?? new Prisma.Decimal(0);
  const todayRevenue = todayRevenueAgg._sum?.total ?? new Prisma.Decimal(0);

  return {
    total_users: totalUsers,
    total_customers: totalCustomers,
    total_vendors: totalVendors,
    total_delivery_partners: totalDeliveryPartners,
    total_products: totalProducts,
    total_categories: totalCategories,
    total_orders: totalOrders,
    total_revenue: totalRevenue,
    total_gmv: totalRevenue,
    avg_order_value: totalOrders > 0 ? totalRevenue.div(totalOrders) : new Prisma.Decimal(0),
    today_orders: todayOrders,
    today_revenue: todayRevenue,
    pending_orders: pendingOrders,
    pending_vendors: pendingVendors,
    pending_delivery_partners: pendingDeliveryPartners,
    active_vendors: activeVendors,
    active_users: activeUsers,
    new_users_30d: newUsers30d,
    new_orders_30d: newOrders30d,
    low_stock_products: lowStockProducts,
  };
}

export async function countUsersByRole(slug: string): Promise<number> {
  return prisma.user.count({ where: { deleted_at: null, role: { slug } } });
}

export interface DashboardChartPoint {
  name: string;
  revenue: number;
  users: number;
  vendors: number;
  orders: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(d: Date): string {
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]}`;
}

export async function getDashboardCharts(days = 30): Promise<DashboardChartPoint[]> {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<Array<{
    day: Date;
    revenue: Prisma.Decimal;
    users: bigint;
    vendors: bigint;
    orders: bigint;
  }>>(
    Prisma.sql`
      SELECT
        gs.day::date AS day,
        COALESCE(r.revenue, 0) AS revenue,
        COALESCE(u.users, 0) AS users,
        COALESCE(v.vendors, 0) AS vendors,
        COALESCE(o.orders, 0) AS orders
      FROM generate_series(${start}::timestamp, CURRENT_DATE::timestamp, interval '1 day') AS gs(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE deleted_at IS NULL
          AND status NOT IN ('cancelled', 'failed')
          AND created_at >= ${start}
        GROUP BY 1
      ) r ON r.day = gs.day::date
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS users
        FROM users
        WHERE deleted_at IS NULL AND created_at >= ${start}
        GROUP BY 1
      ) u ON u.day = gs.day::date
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS vendors
        FROM vendor_profiles
        WHERE deleted_at IS NULL AND created_at >= ${start}
        GROUP BY 1
      ) v ON v.day = gs.day::date
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS orders
        FROM orders
        WHERE deleted_at IS NULL AND created_at >= ${start}
        GROUP BY 1
      ) o ON o.day = gs.day::date
      ORDER BY gs.day::date ASC
    `
  );

  return rows.map((r) => ({
    name: formatDay(r.day),
    revenue: Number(r.revenue.toString()),
    users: Number(r.users),
    vendors: Number(r.vendors),
    orders: Number(r.orders),
  }));
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function sumSeries(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export async function getDashboardTrends(): Promise<{
  revenue_trend: number;
  user_trend: number;
  vendor_trend: number;
  orders_trend: number;
}> {
  const points = await getDashboardCharts(14);
  const week = points.length;
  const firstHalf = points.slice(0, Math.floor(week / 2));
  const secondHalf = points.slice(Math.floor(week / 2));

  const current = {
    revenue: sumSeries(secondHalf.map((p) => p.revenue)),
    users: sumSeries(secondHalf.map((p) => p.users)),
    vendors: sumSeries(secondHalf.map((p) => p.vendors)),
    orders: sumSeries(secondHalf.map((p) => p.orders)),
  };
  const previous = {
    revenue: sumSeries(firstHalf.map((p) => p.revenue)),
    users: sumSeries(firstHalf.map((p) => p.users)),
    vendors: sumSeries(firstHalf.map((p) => p.vendors)),
    orders: sumSeries(firstHalf.map((p) => p.orders)),
  };

  return {
    revenue_trend: percentChange(current.revenue, previous.revenue),
    user_trend: percentChange(current.users, previous.users),
    vendor_trend: percentChange(current.vendors, previous.vendors),
    orders_trend: percentChange(current.orders, previous.orders),
  };
}
