import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as userRepo from "../repositories/user.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as refreshTokenRepo from "../repositories/refresh-token.repository";
import { findBySlug as findRoleBySlug } from "../repositories/role.repository";
import { hashPassword } from "../utils/password";
import { enforcePasswordPolicy } from "../utils/password-policy";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { ROLES } from "../constants/roles";

function sanitizeUser(user: Record<string, unknown>): Record<string, unknown> {
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

export const adminUserService = {
  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    role?: string;
    status?: string;
    is_verified?: string;
    provider?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await userRepo.listUsersAdmin(
      {
        q: query.q,
        role: query.role,
        status: query.status,
        isVerified: query.is_verified === "true" ? true : query.is_verified === "false" ? false : undefined,
        provider: query.provider,
      },
      (page - 1) * perPage,
      perPage
    );
    const serialized = rows.map((u) => {
      const safe = sanitizeUser(u as Record<string, unknown>);
      return {
        ...safe,
        is_active: (u as { status?: string }).status === "ACTIVE",
      };
    });
    return { rows: serialized, total, page, perPage };
  },

  async getById(id: string) {
    const user = await userRepo.findByIdAdmin(id);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    return sanitizeUser(user as unknown as Record<string, unknown>);
  },

  async suspend(adminUserId: string, targetUserId: string, reason: string | null, req: Request) {
    const user = await userRepo.findById(targetUserId);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    if (user.id === adminUserId) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "You cannot suspend your own account.", { code: "SELF_ACTION" });
    }
    const updated = await userRepo.updateStatus(targetUserId, "SUSPENDED");
    await sessionRepo.revokeAllForUser(targetUserId);
    await refreshTokenRepo.revokeAllForUser(targetUserId);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_SUSPENDED, entityType: "user", entityId: targetUserId, newValues: { reason } },
      req
    );
    return sanitizeUser(updated as unknown as Record<string, unknown>);
  },

  async activate(adminUserId: string, targetUserId: string, req: Request) {
    const user = await userRepo.findById(targetUserId);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    const updated = await userRepo.updateStatus(targetUserId, "ACTIVE");
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_ACTIVATED, entityType: "user", entityId: targetUserId },
      req
    );
    return sanitizeUser(updated as unknown as Record<string, unknown>);
  },

  async remove(adminUserId: string, targetUserId: string, req: Request) {
    const user = await userRepo.findById(targetUserId);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    if (user.id === adminUserId) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "You cannot delete your own account.", { code: "SELF_ACTION" });
    }
    await userRepo.softDelete(targetUserId);
    await sessionRepo.revokeAllForUser(targetUserId);
    await refreshTokenRepo.revokeAllForUser(targetUserId);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_DEACTIVATED, entityType: "user", entityId: targetUserId },
      req
    );
    return { success: true };
  },

  async restore(adminUserId: string, targetUserId: string, req: Request) {
    const user = await userRepo.restore(targetUserId);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_RESTORED, entityType: "user", entityId: targetUserId },
      req
    );
    return sanitizeUser(user as unknown as Record<string, unknown>);
  },

  async resetPassword(adminUserId: string, targetUserId: string, newPassword: string, req: Request) {
    const user = await userRepo.findById(targetUserId);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    const passwordHash = await hashPassword(newPassword);
    const { history } = await enforcePasswordPolicy(
      user.password_hash,
      user.password_history,
      newPassword
    );
    await userRepo.updatePassword(targetUserId, passwordHash, history);
    await userRepo.update(targetUserId, { failed_login_attempts: 0, locked_until: null });
    await sessionRepo.revokeAllForUser(targetUserId);
    await refreshTokenRepo.revokeAllForUser(targetUserId);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_PASSWORD_RESET_BY_ADMIN, entityType: "user", entityId: targetUserId },
      req
    );
    return { success: true };
  },

  async forceLogout(adminUserId: string, targetUserId: string, req: Request) {
    const user = await userRepo.findById(targetUserId);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    await sessionRepo.revokeAllForUser(targetUserId);
    await refreshTokenRepo.revokeAllForUser(targetUserId);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_FORCE_LOGGED_OUT, entityType: "user", entityId: targetUserId },
      req
    );
    return { success: true };
  },

  async changeRole(adminUserId: string, targetUserId: string, roleSlug: string, req: Request) {
    const user = await userRepo.findById(targetUserId);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    if (user.id === adminUserId) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "You cannot change your own role.", { code: "SELF_ACTION" });
    }
    const role = await findRoleBySlug(roleSlug);
    if (!role) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Unknown role.", { code: "UNKNOWN_ROLE" });
    }
    const privilegedRoles: ReadonlySet<string> = new Set([ROLES.ADMIN, ROLES.SUPER_ADMIN]);
    if (privilegedRoles.has(roleSlug)) {
      const admin = await userRepo.findById(adminUserId, { role: true });
      if (admin?.role?.slug !== ROLES.SUPER_ADMIN) {
        throw new ApiError(HttpStatus.FORBIDDEN, "Only a super admin can grant admin roles.", {
          code: "INSUFFICIENT_PERMISSION",
        });
      }
    }
    const updated = await userRepo.changeRole(targetUserId, role.id);
    await sessionRepo.revokeAllForUser(targetUserId);
    await refreshTokenRepo.revokeAllForUser(targetUserId);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.USER_ROLE_CHANGED, entityType: "user", entityId: targetUserId, oldValues: { role: user.role_id }, newValues: { role: role.slug } },
      req
    );
    return sanitizeUser(updated as unknown as Record<string, unknown>);
  },
};
