import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { SendCommandFn } from "rate-limit-redis";

import log from "../../config/logger";
import { isRedisAvailable, redis } from "../../database/redis";
import { HttpStatus } from "../../utils/httpStatus";
import { safeEqual } from "../../utils/crypto";
import { maintenanceModuleConfig } from "./maintenance.constants";
import { maintenanceService } from "./maintenance.service";
import type { MaintenanceGateOptions } from "./maintenance.types";

const config = maintenanceModuleConfig();

function buildStore() {
  if (isRedisAvailable() && redis) {
    const client = redis as import("ioredis").Redis;
    const sendCommand: SendCommandFn = (command, ...args) =>
      client.call(command, ...args) as ReturnType<SendCommandFn>;
    return new RedisStore({ sendCommand });
  }
  return undefined;
}

function createMaintenanceLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore(),
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "unknown"),
    handler: (_req: Request, res: Response) => {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        error: { code: "RATE_LIMITED", message },
      });
    },
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message },
    },
  });
}

export const maintenanceApiLimiter = createMaintenanceLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMax,
  "Too many maintenance control requests, please slow down."
);

const LOOPBACK_ADDRESSES = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);

function isLoopbackAddress(remoteAddress: string): boolean {
  return LOOPBACK_ADDRESSES.has(remoteAddress);
}

export function requireToggleAccess(req: Request, res: Response, next: NextFunction): void {
  if (config.toggleToken) {
    const provided = typeof req.query.token === "string" ? req.query.token : "";
    if (provided && safeEqual(provided, config.toggleToken)) {
      next();
      return;
    }
    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing toggle token.",
      },
    });
    return;
  }
  const remoteAddress = req.socket?.remoteAddress ?? "";
  if (isLoopbackAddress(remoteAddress)) {
    next();
    return;
  }
  res.status(HttpStatus.FORBIDDEN).json({
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "This endpoint is only reachable from the server (localhost) unless a toggle token is configured.",
    },
  });
}

function isPathExcluded(url: string, paths: string[]): boolean {
  const pathname = url.split("?")[0] ?? url;
  return paths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function checkMaintenanceMode(options: MaintenanceGateOptions = {}): RequestHandler {
  const excluded = [
    ...(options.excludedPaths ?? []),
    ...(options.excludedPathPrefixes ?? []),
  ];
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isPathExcluded(req.originalUrl, excluded)) {
      next();
      return;
    }
    if (options.exclude && options.exclude(req)) {
      next();
      return;
    }

    try {
      const enabled = await maintenanceService.isMaintenanceEnabled();
      if (!enabled) {
        next();
        return;
      }
      const status = await maintenanceService.getPublicStatus();
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        maintenance: true,
        message: status.message,
      });
    } catch (error) {
      logMaintenanceError(error);
      next();
    }
  };
}

function logMaintenanceError(error: unknown): void {
  log.error("[maintenance] Maintenance gate error, failing open", {
    context: "maintenance",
    error: error instanceof Error ? error.message : String(error),
  });
}
