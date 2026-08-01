import type { Request } from "express";

import { auditService } from "./audit.service";
import * as dashboardRepo from "../repositories/dashboard.repository";
import { cacheService } from "../database/cache";

export const dashboardService = {
  async getMetrics(adminUserId: string, req: Request) {
    const metrics = await cacheService.remember("dashboard", "overview", () =>
      dashboardRepo.getDashboardMetrics()
    );

    await auditService.record(
      { userId: adminUserId, action: "admin.dashboard.viewed", entityType: "dashboard" },
      req
    );

    return {
      ...metrics,
      total_revenue: Number(metrics.total_revenue),
      total_gmv: Number(metrics.total_gmv),
      avg_order_value: Number(metrics.avg_order_value),
      today_revenue: Number(metrics.today_revenue),
    };
  },
};
