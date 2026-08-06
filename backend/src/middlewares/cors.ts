import type { NextFunction, Request, Response } from "express";

import { env } from "../config";
import { HttpStatus } from "../utils/httpStatus";

const ALLOWED_ORIGINS = new Set<string>(
  [
    env.CLIENT_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
  ].filter(Boolean)
);

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const ALLOWED_HEADERS = ["Content-Type", "Authorization", "X-Request-ID", "X-API-Key"];
const EXPOSED_HEADERS = ["X-Request-ID"];
const MAX_AGE = 86400;

function applyCorsHeaders(res: Response, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
  res.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS.join(", "));
  res.setHeader("Access-Control-Max-Age", String(MAX_AGE));
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header("Origin");

  if (!origin) {
    return next();
  }

  if (ALLOWED_ORIGINS.has(origin)) {
    applyCorsHeaders(res, origin);

    if (req.method === "OPTIONS") {
      res.status(HttpStatus.NO_CONTENT).end();
      return;
    }
    return next();
  }

  res.status(HttpStatus.FORBIDDEN).json({
    success: false,
    error: {
      code: "CORS_ORIGIN_NOT_ALLOWED",
      message: `Origin "${origin}" is not allowed by CORS policy.`,
    },
    requestId: req.requestId,
  });
}
