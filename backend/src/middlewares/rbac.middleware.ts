import type { NextFunction, Request, Response } from "express";

import { findById as findUserById } from "../repositories/user.repository";
import { ForbiddenError, UnauthorizedError } from "../utils/ApiError";
import { isApiError } from "../utils/ApiError";

async function hydrateUser(req: Request): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (req.user.permissions && req.user.permissions.length > 0) {
    return;
  }

  try {
    const user = await findUserById(req.user.id, { role: true });
    if (!user) {
      throw new UnauthorizedError("User no longer exists.");
    }
    req.user.permissions = user.role.role_permissions.map((p) => p.permission.slug);
    req.user.role_id = user.role_id;
    req.user.vendor_id = user.vendor_profile?.id ?? null;
    req.user.delivery_id = user.delivery_profile?.id ?? null;
    req.user.is_verified = user.is_verified;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    throw new ForbiddenError("Unable to resolve permissions.");
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError());
      }
      await hydrateUser(req);
      const granted = req.user.permissions ?? [];
      const missing = permissions.filter((p) => !granted.includes(p));
      if (missing.length > 0) {
        return next(new ForbiddenError());
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
