import type { NextFunction, Request, Response } from "express";

import { GUEST_USER_ID } from "../constants";
import { verifyAccessToken } from "../services/token.service";
import { UnauthorizedError } from "../utils/ApiError";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token.trim();
}

function buildGuestUser(): Express.Request["user"] {
  return {
    id: GUEST_USER_ID,
    email: "guest@galiconnect.local",
    name: "Guest",
    role: "customer",
    role_id: "",
    permissions: [],
    vendor_id: null,
    delivery_id: null,
    is_verified: false,
  };
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    return next(new UnauthorizedError());
  }

  try {
    const claims = verifyAccessToken(token);

    if (claims.guest) {
      req.user = buildGuestUser();
      return next();
    }

    req.user = {
      id: claims.sub,
      email: claims.email,
      name: "",
      role: claims.role,
      role_id: "",
      permissions: [],
      vendor_id: null,
      delivery_id: null,
      is_verified: false,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function blockGuest(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.id === GUEST_USER_ID) {
    return next(new UnauthorizedError("Please sign in to your account to continue."));
  }
  next();
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    return next();
  }

  try {
    const claims = verifyAccessToken(token);
    if (claims.guest) {
      req.user = buildGuestUser();
      return next();
    }
    req.user = {
      id: claims.sub,
      email: claims.email,
      name: "",
      role: claims.role,
      role_id: "",
      permissions: [],
      vendor_id: null,
      delivery_id: null,
      is_verified: false,
    };
    next();
  } catch {
    next();
  }
}
