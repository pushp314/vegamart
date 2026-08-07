import type { Request } from "express";

import { prisma } from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { findByUserId, findActiveById, revoke, revokeAllForUser, updateLastActivity } from "../repositories/session.repository";
import { findById as findUserById, softDelete, update as updateUserRepo } from "../repositories/user.repository";
import { ApiError, UnauthorizedError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { serializeUser } from "../utils/serializeUser";

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export const userService = {
  async getProfile(userId: string) {
    const user = await findUserById(userId, { role: true, vendor: true, delivery: true });
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }
    return serializeUser(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput, req: Request) {
    const existing = await findUserById(userId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.avatar_url !== undefined) data.avatar_url = input.avatar_url || null;
    if (input.phone !== undefined) {
      const phone = (input.phone ?? "").trim();
      if (phone && phone !== existing.phone) {
        const { findByPhone } = await import("../repositories/user.repository");
        const taken = await findByPhone(phone);
        if (taken && taken.id !== userId) {
          throw new ApiError(HttpStatus.CONFLICT, "Phone number is already in use.", {
            code: "PHONE_TAKEN",
          });
        }
      }
      data.phone = phone || null;
    }

    await updateUserRepo(userId, data as never);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PROFILE_UPDATED, entityType: "user", entityId: userId, newValues: data },
      req
    );

    return this.getProfile(userId);
  },

  async deactivate(userId: string, req: Request): Promise<void> {
    await softDelete(userId);
    await revokeAllForUser(userId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.USER_DEACTIVATED, entityType: "user", entityId: userId },
      req
    );
  },

  async listSessions(userId: string) {
    const sessions = await findByUserId(userId);
    return sessions.map((s) => ({
      id: s.id,
      device_name: s.device_name,
      device_type: s.device_type,
      ip_address: s.ip_address,
      last_activity_at: s.last_activity_at.toISOString(),
      created_at: s.created_at.toISOString(),
      is_active: s.is_active,
    }));
  },

  async revokeSession(userId: string, sessionId: string, req: Request): Promise<void> {
    const sessions = await findByUserId(userId);
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Session not found.", { code: "NOT_FOUND" });
    }
    await revoke(sessionId);
    await auditService.record(
      { userId, action: "user.session.revoked", entityType: "session", entityId: sessionId },
      req
    );
  },

  async revokeAllSessions(userId: string, req: Request): Promise<void> {
    await revokeAllForUser(userId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.USER_LOGOUT_ALL, entityType: "user", entityId: userId },
      req
    );
  },

  async getSession(sessionId: string): Promise<{ id: string; user_id: string }> {
    const session = await findActiveById(sessionId);
    if (!session) {
      throw new UnauthorizedError("Session is invalid or has been revoked.");
    }
    return { id: session.id, user_id: session.user_id };
  },

  async touchSession(sessionId: string): Promise<void> {
    await updateLastActivity(sessionId);
  },

  async toggleVendorSubscription(userId: string, vendorId: string) {
    try {
      const existing = await prisma.userSubscription.findFirst({
        where: { user_id: userId, vendor_id: vendorId }
      });
      if (existing) {
        await prisma.userSubscription.delete({ where: { id: existing.id } });
        return { subscribed: false };
      } else {
        await prisma.userSubscription.create({ data: { user_id: userId, vendor_id: vendorId } });
        return { subscribed: true };
      }
    } catch (error) {
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to update vendor subscription",
        { code: "SUBSCRIPTION_UPDATE_FAILED" }
      );
    }
  },
};
