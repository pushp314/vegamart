import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { SendCommandFn } from "rate-limit-redis";

import log from "../../config/logger";
import { isRedisAvailable, redis } from "../../database/redis";
import { HttpStatus } from "../../utils/httpStatus";
import { MAINTENANCE_AUDIT_ACTIONS, maintenanceModuleConfig } from "./maintenance.constants";
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

export const maintenanceAuthLimiter = createMaintenanceLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMax,
  "Too many maintenance developer token requests, please slow down."
);

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

export function requireDeveloper(req: Request, _res: Response, next: NextFunction): void {
  const ip = req.ip ?? "";
  const audit = maintenanceService.extractAuditContext(req);

  (async () => {
    if (!maintenanceService.isDeveloperIpAllowed(ip)) {
      await maintenanceService.logAudit(
        MAINTENANCE_AUDIT_ACTIONS.AUTH_FAILED,
        "developer",
        audit,
        "Developer IP not allowed."
      );
      const error = new Error("Developer IP not allowed.");
      (error as Error & { statusCode: number; code: string }).statusCode = HttpStatus.FORBIDDEN;
      (error as Error & { statusCode: number; code: string }).code = "FORBIDDEN";
      throw error;
    }

    const identity = await maintenanceService.buildDeveloperIdentity(req);
    req.maintenanceDeveloper = identity;
    next();
  })().catch((error: unknown) => {
    maintenanceService.logAudit(
      MAINTENANCE_AUDIT_ACTIONS.AUTH_FAILED,
      "developer",
      audit,
      error instanceof Error ? error.message : "Developer authentication failed."
    );
    next(error);
  });
}

function logMaintenanceError(error: unknown): void {
  log.error("[maintenance] Maintenance gate error, failing open", {
    context: "maintenance",
    error: error instanceof Error ? error.message : String(error),
  });
}
