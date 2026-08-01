import type { Request } from "express";

import * as analyticsRepo from "../repositories/analytics.repository";
import { cacheService } from "../database/cache";

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

export const analyticsService = {
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
