import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { SendCommandFn } from "rate-limit-redis";
import type { Request } from "express";

import { env } from "../config";
import { isRedisAvailable, redis } from "../database/redis";
import { HttpStatus } from "../utils/httpStatus";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}

function rateLimitResponse(message: string) {
  return (_req: Request, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message,
      },
    });
  };
}

function buildStore() {
  if (isRedisAvailable() && redis) {
    const client = redis as import("ioredis").Redis;
    const sendCommand: SendCommandFn = (command, ...args) =>
      client.call(command, ...args) as ReturnType<SendCommandFn>;
    return new RedisStore({
      sendCommand,
    });
  }
  return undefined;
}

function createLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore(),
    keyGenerator: config.keyGenerator,
    handler: rateLimitResponse(config.message),
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message: config.message },
    },
  });
}

export const apiLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: "Too many requests, please slow down.",
});

export const authLimiter = createLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: "Too many authentication attempts, please slow down.",
  keyGenerator: identifierKeyGenerator,
});

function identifierKeyGenerator(req: Request): string {
  const body = (req.body ?? {}) as { email?: unknown; identifier?: unknown };
  const id = String(body.email ?? body.identifier ?? "anonymous").toLowerCase().trim();
  return `${ipKeyGenerator(req.ip ?? "unknown")}:${id}`;
}

export const otpLimiter = createLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: Math.max(5, env.AUTH_RATE_LIMIT_MAX),
  message: "Too many OTP attempts for this account, please try again later.",
  keyGenerator: identifierKeyGenerator,
});

export const paymentLimiter = createLimiter({
  windowMs: env.PAYMENT_RATE_LIMIT_WINDOW_MS,
  max: env.PAYMENT_RATE_LIMIT_MAX,
  message: "Too many payment requests, please slow down.",
});

export const uploadLimiter = createLimiter({
  windowMs: env.UPLOAD_RATE_LIMIT_WINDOW_MS,
  max: env.UPLOAD_RATE_LIMIT_MAX,
  message: "Too many uploads, please slow down.",
});

export const adminLimiter = createLimiter({
  windowMs: env.ADMIN_RATE_LIMIT_WINDOW_MS,
  max: env.ADMIN_RATE_LIMIT_MAX,
  message: "Too many admin requests, please slow down.",
});

export const vendorLimiter = createLimiter({
  windowMs: env.VENDOR_RATE_LIMIT_WINDOW_MS,
  max: env.VENDOR_RATE_LIMIT_MAX,
  message: "Too many vendor requests, please slow down.",
});
