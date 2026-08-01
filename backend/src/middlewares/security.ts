import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { isProduction } from "../config";
import { securityEventFromReq } from "../monitoring/security-events";

/**
 * Strict security headers. Helmet defaults already provide CSP, HSTS, and
 * frame protection; we tighten the policy further and add explicit
 * Referrer-Policy and Permissions-Policy headers.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "same-site" },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })(req, res, next);

  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
}

const COMMON_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Brute-force / abuse guard by IP for unauthenticated sensitive endpoints.
 * This is a lightweight in-memory sliding window that complements the
 * database-backed account lockout. It can be swapped for a Redis-backed
 * implementation without changing middleware semantics.
 */
const abuseWindow = new Map<string, { count: number; resetAt: number }>();
const ABUSE_WINDOW_MS = 60_000;
const ABUSE_MAX = 60;

export function ipAbuseGuard(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip;
  if (!ip || COMMON_IPS.has(ip)) {
    return next();
  }
  const now = Date.now();
  const entry = abuseWindow.get(ip);
  if (!entry || entry.resetAt <= now) {
    abuseWindow.set(ip, { count: 1, resetAt: now + ABUSE_WINDOW_MS });
    return next();
  }
  entry.count += 1;
  if (entry.count > ABUSE_MAX) {
    securityEventFromReq("IP_RATE_LIMITED", req, { ip, count: entry.count });
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests from this IP." },
      requestId: req.requestId,
    });
    return;
  }
  next();
}

export function periodicAbuseCleanup(): void {
  const now = Date.now();
  for (const [ip, entry] of abuseWindow.entries()) {
    if (entry.resetAt <= now) {
      abuseWindow.delete(ip);
    }
  }
}
