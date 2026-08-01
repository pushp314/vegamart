import type { NextFunction, Request, Response } from "express";
import {
  collectMetricsSnapshot,
  collectSystemMetrics,
  metrics,
  metricsMiddleware,
  recordCacheAccess,
  recordDbQuery,
} from "../../src/monitoring/metrics";

function makeReqRes() {
  const handlers: Record<string, () => void> = {};
  const req = { originalUrl: "/api/v1/products?page=2" } as unknown as Request;
  const res = {
    statusCode: 200,
    on: jest.fn((event: string, cb: () => void) => {
      handlers[event] = cb;
    }),
    emit: (event: string) => handlers[event]?.(),
  } as unknown as Response & { emit: (e: string) => void };
  return { req, res };
}

describe("monitoring metrics", () => {
  beforeEach(() => {
    metrics.requestsTotal = 0;
    metrics.requestsInFlight = 0;
    metrics.errorsTotal = 0;
    metrics.responsesByStatus = {};
    metrics.requestsByRoute = {};
    metrics.dbQueriesTotal = 0;
    metrics.dbQueriesError = 0;
    metrics.cacheHits = 0;
    metrics.cacheMisses = 0;
    metrics.cacheErrors = 0;
  });

  it("tracks request counts and routes", () => {
    const { req, res } = makeReqRes();
    const next = jest.fn() as NextFunction;
    metricsMiddleware(req, res, next);
    res.statusCode = 200;
    (res as unknown as { emit: (e: string) => void }).emit("finish");
    expect(next).toHaveBeenCalled();
    expect(metrics.requestsTotal).toBe(1);
    expect(metrics.requestsInFlight).toBe(0);
    expect(metrics.requestsByRoute["/api/v1/products"]).toBe(1);
    expect(metrics.responsesByStatus["200"]).toBe(1);
    expect(metrics.errorsTotal).toBe(0);
  });

  it("counts 4xx responses as errors", () => {
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res, jest.fn() as NextFunction);
    res.statusCode = 404;
    (res as unknown as { emit: (e: string) => void }).emit("finish");
    expect(metrics.errorsTotal).toBe(1);
    expect(metrics.responsesByStatus["404"]).toBe(1);
  });

  it("records db queries and errors", () => {
    recordDbQuery(false);
    recordDbQuery(false);
    recordDbQuery(true);
    expect(metrics.dbQueriesTotal).toBe(3);
    expect(metrics.dbQueriesError).toBe(1);
  });

  it("records cache hits, misses and errors", () => {
    recordCacheAccess(true);
    recordCacheAccess(false);
    recordCacheAccess(false, true);
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.cacheMisses).toBe(2);
    expect(metrics.cacheErrors).toBe(1);
  });

  it("computes a cache hit rate", () => {
    recordCacheAccess(true);
    recordCacheAccess(false);
    const snapshot = collectMetricsSnapshot();
    expect(snapshot.cache.hit_rate).toBe(0.5);
  });

  it("returns a zero hit rate when no cache activity", () => {
    const snapshot = collectMetricsSnapshot();
    expect(snapshot.cache.hit_rate).toBe(0);
  });

  it("collects system metrics", () => {
    const sys = collectSystemMetrics();
    expect(sys.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(sys.memory_usage_mb).toBeGreaterThan(0);
    expect(sys.node_version).toBe(process.version);
    expect(sys.pid).toBe(process.pid);
  });

  it("exposes a full snapshot shape", () => {
    const snapshot = collectMetricsSnapshot();
    expect(snapshot.requests).toBeDefined();
    expect(snapshot.response_time_ms.buckets.length).toBeGreaterThan(0);
    expect(snapshot.database).toHaveProperty("queries_total");
    expect(snapshot.system).toHaveProperty("cpu");
  });
});
