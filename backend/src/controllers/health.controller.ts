import type { Request, Response } from "express";

import { env, apiPrefix, isProduction } from "../config";
import { pingDatabase } from "../database/connection";
import { isRedisAvailable, pingRedis } from "../database/redis";
import { collectSystemMetrics } from "../monitoring/metrics";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { HttpStatus } from "../utils/httpStatus";

interface CheckResult {
  status: "ok" | "degraded" | "unavailable";
  checked_at: string;
  details?: Record<string, unknown>;
}

const APP_VERSION = "1.0.0";

function ok(details?: Record<string, unknown>): CheckResult {
  return { status: "ok", checked_at: new Date().toISOString(), details };
}

function degraded(details?: Record<string, unknown>): CheckResult {
  return { status: "degraded", checked_at: new Date().toISOString(), details };
}

function baseReport() {
  return {
    app: env.APP_NAME,
    version: APP_VERSION,
    environment: env.NODE_ENV,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    api_prefix: apiPrefix,
  };
}

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic liveness probe
 *     description: Returns service metadata without touching external dependencies.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive.
 */
export const healthCheck = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, baseReport());
});

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database readiness probe
 *     description: Executes `SELECT 1` against PostgreSQL and reports latency.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database reachable.
 *       503:
 *         description: Database unreachable.
 */
export const healthDatabase = asyncHandler(async (_req: Request, res: Response) => {
  const db = await pingDatabase();
  const check = {
    ...(db.connected
      ? ok({ connected: true, latency_ms: db.latencyMs })
      : degraded({ connected: false, latency_ms: db.latencyMs, error: db.error })),
    connected: db.connected,
  };

  const data = { ...baseReport(), database: check };
  const status = db.connected
    ? HttpStatus.OK
    : isProduction
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.OK;
  res.status(status).json({ success: db.connected, data });
});

/**
 * @swagger
 * /health/redis:
 *   get:
 *     summary: Redis health probe
 *     description: Pings the Redis cache (reports disabled when REDIS_URL is unset).
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Redis reachable or not configured.
 *       503:
 *         description: Redis configured but unreachable.
 */
export const healthRedis = asyncHandler(async (_req: Request, res: Response) => {
  if (!env.REDIS_URL) {
    const data = { ...baseReport(), redis: degraded({ enabled: false, message: "REDIS_URL is not configured." }) };
    res.status(HttpStatus.OK).json({ success: true, data });
    return;
  }

  const result = await pingRedis();
  const check = result.connected
    ? ok({ enabled: true, latency_ms: result.latencyMs })
    : degraded({ enabled: true, connected: false, latency_ms: result.latencyMs });

  const data = { ...baseReport(), redis: check };
  const status = result.connected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
  res.status(status).json({ success: result.connected, data });
});

/**
 * @swagger
 * /health/storage:
 *   get:
 *     summary: Object storage health probe
 *     description: Reports configuration status of the Cloudflare R2 storage backend.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Storage configured.
 *       503:
 *         description: Storage credentials missing.
 */
export const healthStorage = asyncHandler(async (_req: Request, res: Response) => {
  const configured = Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
  );
  const check = configured
    ? ok({ configured: true, provider: "cloudflare-r2", bucket: env.R2_BUCKET_NAME })
    : degraded({ configured: false, message: "R2 credentials are not configured." });

  const data = { ...baseReport(), storage: check };
  res.status(configured ? HttpStatus.OK : isProduction ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK)
    .json({ success: configured, data });
});

/**
 * @swagger
 * /health/payment:
 *   get:
 *     summary: Payment gateway health probe
 *     description: Reports configuration status of the Razorpay gateway.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Payment gateway configured.
 *       503:
 *         description: Payment credentials missing.
 */
export const healthPayment = asyncHandler(async (_req: Request, res: Response) => {
  const configured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  const check = configured
    ? ok({ configured: true, provider: "razorpay" })
    : degraded({ configured: false, message: "Razorpay credentials are not configured." });

  const data = { ...baseReport(), payment: check };
  res.status(configured ? HttpStatus.OK : isProduction ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK)
    .json({ success: configured, data });
});

/**
 * @swagger
 * /health/email:
 *   get:
 *     summary: Email transport health probe
 *     description: Reports configuration status of the SMTP transport.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: SMTP configured.
 *       503:
 *         description: SMTP credentials missing.
 */
export const healthEmail = asyncHandler(async (_req: Request, res: Response) => {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  const check = configured
    ? ok({ configured: true, host: env.SMTP_HOST })
    : degraded({ configured: false, message: "SMTP transport is not configured." });

  const data = { ...baseReport(), email: check };
  res.status(configured ? HttpStatus.OK : isProduction ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK)
    .json({ success: configured, data });
});

/**
 * @swagger
 * /health/system:
 *   get:
 *     summary: System resource health probe
 *     description: Reports memory, CPU and uptime statistics for the running process.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System metrics collected.
 */
export const healthSystem = asyncHandler(async (_req: Request, res: Response) => {
  const data = { ...baseReport(), system: collectSystemMetrics() };
  sendSuccess(res, data);
});

/**
 * @swagger
 * /health/all:
 *   get:
 *     summary: Aggregate health report
 *     description: Runs every subsystem probe and returns a structured report.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All subsystems healthy or degraded but non-critical.
 *       503:
 *         description: A critical subsystem is unavailable in production.
 */
export const healthAll = asyncHandler(async (_req: Request, res: Response) => {
  const db = await pingDatabase();
  const redisResult = env.REDIS_URL ? await pingRedis() : null;

  const report = {
    ...baseReport(),
    database: {
      ...(db.connected
        ? ok({ connected: true, latency_ms: db.latencyMs })
        : degraded({ connected: false, latency_ms: db.latencyMs, error: db.error })),
      connected: db.connected,
    },
    redis: env.REDIS_URL
      ? redisResult?.connected
        ? ok({ enabled: true, latency_ms: redisResult.latencyMs })
        : degraded({ enabled: true, connected: false })
      : degraded({ enabled: false, message: "REDIS_URL is not configured." }),
    storage: env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
      ? ok({ configured: true })
      : degraded({ configured: false }),
    payment: env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
      ? ok({ configured: true })
      : degraded({ configured: false }),
    email: env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
      ? ok({ configured: true })
      : degraded({ configured: false }),
    system: collectSystemMetrics(),
    cache_available: isRedisAvailable(),
  };

  const criticalDown = isProduction && !db.connected;
  sendSuccess(res, report, { status: criticalDown ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK });
});
