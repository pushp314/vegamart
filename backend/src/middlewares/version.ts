import type { NextFunction, Request, Response } from "express";

/**
 * Reusable API version middleware.
 *
 * Mounting:
 *   app.use("/api/v2", apiVersion("v2"), v2Routes);
 *
 * It exposes the active version on `req.apiVersion`, forwards the negotiated
 * `Accept-Version` header into the response, and is future-proof for both
 * path-based and header-based version negotiation.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}

export const SUPPORTED_API_VERSIONS = ["v1", "v2"] as const;
export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export function isSupportedVersion(version: string): version is ApiVersion {
  return (SUPPORTED_API_VERSIONS as readonly string[]).includes(version);
}

export function apiVersion(version: ApiVersion) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.apiVersion = version;
    res.setHeader("API-Version", version);
    next();
  };
}

/**
 * Header-based version negotiation (falls back to latest supported version).
 */
export function negotiateVersion(req: Request, res: Response, next: NextFunction): void {
  const header = (req.header("Accept-Version") ?? "").toLowerCase().trim();
  const version = isSupportedVersion(header) ? header : "v1";
  req.apiVersion = version;
  res.setHeader("API-Version", version);
  next();
}
