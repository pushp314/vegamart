import os from "os";

import type { Request, Response, NextFunction } from "express";

interface HistogramBucket {
  bound: number;
  count: number;
}

interface MetricsState {
  startedAt: number;
  requestsTotal: number;
  requestsInFlight: number;
  errorsTotal: number;
  responsesByStatus: Record<string, number>;
  responseTimeMsBuckets: HistogramBucket[];
  requestsByRoute: Record<string, number>;
  dbQueriesTotal: number;
  dbQueriesError: number;
  cacheHits: number;
  cacheMisses: number;
  cacheErrors: number;
}

const BUCKET_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

function makeBuckets(): HistogramBucket[] {
  return BUCKET_MS.map((bound) => ({ bound, count: 0 }));
}

export const metrics: MetricsState = {
  startedAt: Date.now(),
  requestsTotal: 0,
  requestsInFlight: 0,
  errorsTotal: 0,
  responsesByStatus: {},
  responseTimeMsBuckets: makeBuckets(),
  requestsByRoute: {},
  dbQueriesTotal: 0,
  dbQueriesError: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheErrors: 0,
};

export function recordDbQuery(error: boolean): void {
  metrics.dbQueriesTotal += 1;
  if (error) metrics.dbQueriesError += 1;
}

export function recordCacheAccess(hit: boolean, error = false): void {
  if (hit) metrics.cacheHits += 1;
  else metrics.cacheMisses += 1;
  if (error) metrics.cacheErrors += 1;
}

function recordBucket(durationMs: number): void {
  const bucket = metrics.responseTimeMsBuckets.find((b) => durationMs <= b.bound);
  if (bucket) {
    bucket.count += 1;
  }
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  metrics.requestsTotal += 1;
  metrics.requestsInFlight += 1;

  const route = req.originalUrl.split("?")[0] ?? "/";
  metrics.requestsByRoute[route] = (metrics.requestsByRoute[route] ?? 0) + 1;

  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    metrics.requestsInFlight -= 1;
    const status = String(res.statusCode);
    metrics.responsesByStatus[status] = (metrics.responsesByStatus[status] ?? 0) + 1;
    if (res.statusCode >= 400) {
      metrics.errorsTotal += 1;
    }
    recordBucket(durationMs);
  });

  next();
}

export interface SystemMetrics {
  uptime_seconds: number;
  memory_usage_mb: number;
  heap_used_mb: number;
  heap_total_mb: number;
  rss_mb: number;
  cpu: {
    user: number;
    system: number;
    load_avg: number[];
  };
  node_version: string;
  pid: number;
}

export function collectSystemMetrics(): SystemMetrics {
  const memory = process.memoryUsage();
  return {
    uptime_seconds: Math.round(process.uptime()),
    memory_usage_mb: roundMb(memory.rss),
    heap_used_mb: roundMb(memory.heapUsed),
    heap_total_mb: roundMb(memory.heapTotal),
    rss_mb: roundMb(memory.rss),
    cpu: {
      user: process.cpuUsage().user,
      system: process.cpuUsage().system,
      load_avg: os.loadavg(),
    },
    node_version: process.version,
    pid: process.pid,
  };
}

function roundMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

export function collectMetricsSnapshot() {
  return {
    uptime_seconds: Math.round((Date.now() - metrics.startedAt) / 1000),
    requests: {
      total: metrics.requestsTotal,
      in_flight: metrics.requestsInFlight,
      errors: metrics.errorsTotal,
      by_status: metrics.responsesByStatus,
      by_route: metrics.requestsByRoute,
    },
    response_time_ms: {
      buckets: metrics.responseTimeMsBuckets,
    },
    database: {
      queries_total: metrics.dbQueriesTotal,
      queries_error: metrics.dbQueriesError,
    },
    cache: {
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses,
      errors: metrics.cacheErrors,
      hit_rate: metrics.cacheHits + metrics.cacheMisses > 0
        ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 1000) / 1000
        : 0,
    },
    system: collectSystemMetrics(),
  };
}
