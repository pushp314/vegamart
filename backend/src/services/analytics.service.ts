import type { Request } from "express";

import * as analyticsRepo from "../repositories/analytics.repository";
import { cacheService } from "../database/cache";
import prisma from "../database/prisma";
import log from "../config/logger";

function resolveRange(params: { from?: string; to?: string; days?: string }): analyticsRepo.DateRange {
  const now = new Date();
  if (params.from && params.to) {
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
      return { from, to };
    }
  }
  const days = params.days ? Number(params.days) : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from, to: now };
}

function rangeKey(range: analyticsRepo.DateRange): string {
  return `${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}`;
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export const analyticsService = {
  /**
   * Best-effort event ingestion for the StoreAnalytics / ProductAnalytics /
   * CustomerAnalytics tables. Failures are logged and never propagated so a
   * tracking miss can never break a store view, product view, or checkout.
   */

  async trackStoreView(vendorId: string): Promise<void> {
    try {
      await prisma.storeAnalytics.upsert({
        where: { vendor_id_date: { vendor_id: vendorId, date: startOfToday() } },
        update: { store_views: { increment: 1 } },
        create: { vendor_id: vendorId, date: startOfToday(), store_views: 1 },
      });
    } catch (error) {
      log.error(`[analytics] Failed to record store view for vendor ${vendorId}`, {
        context: "analytics",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async trackProductView(productId: string): Promise<void> {
    try {
      await prisma.productAnalytics.upsert({
        where: { product_id_date: { product_id: productId, date: startOfToday() } },
        update: { views: { increment: 1 } },
        create: { product_id: productId, date: startOfToday(), views: 1 },
      });
    } catch (error) {
      log.error(`[analytics] Failed to record product view for product ${productId}`, {
        context: "analytics",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async recordOrder(
    vendorId: string,
    items: Array<{ product_id: string; quantity: number; total_price: number }>,
    revenue: number
  ): Promise<void> {
    const today = startOfToday();
    try {
      await prisma.storeAnalytics.upsert({
        where: { vendor_id_date: { vendor_id: vendorId, date: today } },
        update: { total_orders: { increment: 1 }, total_revenue: { increment: revenue } },
        create: { vendor_id: vendorId, date: today, total_orders: 1, total_revenue: revenue },
      });
    } catch (error) {
      log.error(`[analytics] Failed to record store analytics for vendor ${vendorId}`, {
        context: "analytics",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    for (const item of items) {
      try {
        await prisma.productAnalytics.upsert({
          where: { product_id_date: { product_id: item.product_id, date: today } },
          update: { sales: { increment: item.quantity }, revenue: { increment: item.total_price } },
          create: {
            product_id: item.product_id,
            date: today,
            sales: item.quantity,
            revenue: item.total_price,
          },
        });
      } catch (error) {
        log.error(`[analytics] Failed to record product analytics for product ${item.product_id}`, {
          context: "analytics",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  },

  /**
   * Records a customer as new or repeat for a vendor on the current day.
   * A customer is "repeat" if they have placed any prior non-cancelled order
   * with the vendor (excluding the current order).
   */
  async recordCustomer(vendorId: string, userId: string, currentOrderId: string): Promise<void> {
    try {
      const priorOrder = await prisma.order.findFirst({
        where: {
          user_id: userId,
          vendor_id: vendorId,
          id: { not: currentOrderId },
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        select: { id: true },
      });

      const today = startOfToday();
      const data = priorOrder
        ? { vendor_id: vendorId, date: today, repeat_customers: 1 }
        : { vendor_id: vendorId, date: today, new_customers: 1 };
      const increments = priorOrder
        ? { repeat_customers: { increment: 1 } }
        : { new_customers: { increment: 1 } };

      await prisma.customerAnalytics.upsert({
        where: { vendor_id_date: { vendor_id: vendorId, date: today } },
        update: increments,
        create: data,
      });
    } catch (error) {
      log.error(`[analytics] Failed to record customer analytics for vendor ${vendorId}`, {
        context: "analytics",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async topProducts(params: { from?: string; to?: string; days?: string; limit?: number }, _req: Request) {
    const range = resolveRange(params);
    const limit = Math.min(100, Math.max(1, params.limit ?? 10));
    const rows = await cacheService.remember("analytics", `topProducts:${rangeKey(range)}:${limit}`, () =>
      analyticsRepo.topProducts(range, limit)
    );
    return (rows ?? []).map((r) => ({ ...r, revenue: toNumber(r.revenue) }));
  },

  async topVendors(params: { from?: string; to?: string; days?: string; limit?: number }, _req: Request) {
    const range = resolveRange(params);
    const limit = Math.min(100, Math.max(1, params.limit ?? 10));
    const rows = await cacheService.remember("analytics", `topVendors:${rangeKey(range)}:${limit}`, () =>
      analyticsRepo.topVendors(range, limit)
    );
    return (rows ?? []).map((r) => ({ ...r, revenue: toNumber(r.revenue) }));
  },

  async topCustomers(params: { from?: string; to?: string; days?: string; limit?: number }, _req: Request) {
    const range = resolveRange(params);
    const limit = Math.min(100, Math.max(1, params.limit ?? 10));
    const rows = await cacheService.remember("analytics", `topCustomers:${rangeKey(range)}:${limit}`, () =>
      analyticsRepo.topCustomers(range, limit)
    );
    return (rows ?? []).map((r) => ({ ...r, spend: toNumber(r.spend) }));
  },

  async categorySales(params: { from?: string; to?: string; days?: string }, _req: Request) {
    const range = resolveRange(params);
    const rows = await cacheService.remember("analytics", `categorySales:${rangeKey(range)}`, () =>
      analyticsRepo.categorySales(range)
    );
    return (rows ?? []).map((r) => ({ ...r, revenue: toNumber(r.revenue) }));
  },

  async trends(params: { from?: string; to?: string; days?: string }, _req: Request) {
    const range = resolveRange(params);
    const rows = await cacheService.remember("analytics", `orderTrend:${rangeKey(range)}`, () =>
      analyticsRepo.orderTrend(range)
    );
    return (rows ?? []).map((r) => ({
      period_start: r.period_start.toISOString(),
      orders: r.orders,
      revenue: toNumber(r.revenue),
    }));
  },

  async growth(params: { from?: string; to?: string }, _req: Request) {
    const now = new Date();
    let current: analyticsRepo.DateRange;
    if (params.from && params.to) {
      current = resolveRange(params);
    } else {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      current = { from, to: now };
    }

    const durationMs = current.to.getTime() - current.from.getTime();
    const previous = {
      from: new Date(current.from.getTime() - durationMs),
      to: new Date(current.from),
    };

    const metrics = await cacheService.remember("analytics", `growth:${rangeKey(current)}`, () =>
      analyticsRepo.growthMetrics(current, previous)
    );
    return {
      ...metrics,
      current: {
        ...metrics.current,
        revenue: toNumber(metrics.current.revenue),
      },
      previous: {
        ...metrics.previous,
        revenue: toNumber(metrics.previous.revenue),
      },
    };
  },
};
