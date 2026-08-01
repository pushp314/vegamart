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
