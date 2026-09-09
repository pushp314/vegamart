import type { NextFunction, Request, Response } from "express";

import { GUEST_USER_ID } from "../constants";
import { verifyAccessToken } from "../services/token.service";
import { findActiveById as findActiveSessionById } from "../repositories/session.repository";
import { findById as findUserById } from "../repositories/user.repository";
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

async function hydrateProfileId(user: { id: string; role: string; vendor_id?: string | null; delivery_id?: string | null }): Promise<void> {
  if (user.role !== "delivery" && user.role !== "vendor") return;
  if (user.vendor_id || user.delivery_id) return;
  try {
    const dbUser = await findUserById(user.id, {
      vendor: user.role === "vendor",
      delivery: user.role === "delivery",
    });
    if (dbUser) {
      user.vendor_id = (dbUser as any).vendor_profile?.id ?? null;
      user.delivery_id = (dbUser as any).delivery_profile?.id ?? null;
    }
  } catch {
    // Non-critical — downstream services that need these IDs will re-check
  }
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
    session_id: null,
  };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
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

    // Real-user access tokens always embed a session_id. If that session was
    // revoked (logout, password change, admin suspension/deletion), the token is
    // dead on arrival instead of remaining usable until it expires.
    if (claims.session_id) {
      const activeSession = await findActiveSessionById(claims.session_id);
      if (!activeSession) {
        return next(new UnauthorizedError("Your session has expired. Please sign in again."));
      }
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
      session_id: claims.session_id ?? null,
    };

    await hydrateProfileId(req.user);

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

export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
    // A token whose session was revoked is treated like an invalid token: the
    // request proceeds as anonymous.
    if (claims.session_id) {
      const activeSession = await findActiveSessionById(claims.session_id);
      if (!activeSession) {
        return next();
      }
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
      session_id: claims.session_id ?? null,
    };
    await hydrateProfileId(req.user);
    next();
  } catch {
    next();
  }
}
