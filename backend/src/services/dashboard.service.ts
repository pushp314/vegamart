import type { Request } from "express";

import { auditService } from "./audit.service";
import * as dashboardRepo from "../repositories/dashboard.repository";
import { cacheService } from "../database/cache";

export const dashboardService = {
  async getMetrics(adminUserId: string, req: Request) {
    const [metrics, chartPoints, trends] = await Promise.all([
      cacheService.remember("dashboard", "overview", () => dashboardRepo.getDashboardMetrics()),
      cacheService.remember("dashboard", "charts", () => dashboardRepo.getDashboardCharts()),
      cacheService.remember("dashboard", "trends", () => dashboardRepo.getDashboardTrends()),
    ]);

    await auditService.record(
      { userId: adminUserId, action: "admin.dashboard.viewed", entityType: "dashboard" },
      req
    );

    return {
      ...metrics,
      revenue_chart: chartPoints.map((p) => ({ name: p.name, revenue: p.revenue })),
      user_chart: chartPoints.map((p) => ({ name: p.name, users: p.users })),
      vendor_chart: chartPoints.map((p) => ({ name: p.name, vendors: p.vendors })),
      orders_chart: chartPoints.map((p) => ({ name: p.name, orders: p.orders })),
      ...trends,
      total_revenue: Number(metrics.total_revenue),
      total_gmv: Number(metrics.total_gmv),
      avg_order_value: Number(metrics.avg_order_value),
      today_revenue: Number(metrics.today_revenue),
    };
  },
};
