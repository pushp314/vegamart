import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { ROLES } from "../constants/roles";
import { auditService } from "./audit.service";
import * as deliveryRepo from "../repositories/delivery.repository";
import { findByEmail, findByPhone, create as createUser, update as updateUser } from "../repositories/user.repository";
import { findBySlug as findRoleBySlug } from "../repositories/role.repository";
import { prisma } from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { hashPassword } from "../utils/password";
import type { CreateDeliveryPartnerBody } from "../validators/admin.validators";

export const adminDeliveryService = {
  async create(adminUserId: string, input: CreateDeliveryPartnerBody, req: Request) {
    const email = input.email.trim().toLowerCase();

    const existingEmail = await findByEmail(email);
    if (existingEmail && !existingEmail.deleted_at) {
      throw new ApiError(HttpStatus.CONFLICT, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }
    if (input.phone) {
      const existingPhone = await findByPhone(input.phone);
      if (existingPhone && !existingPhone.deleted_at) {
        throw new ApiError(HttpStatus.CONFLICT, "Phone number is already in use.", {
          code: "PHONE_TAKEN",
        });
      }
      if (existingPhone && existingPhone.deleted_at && existingPhone.id !== existingEmail?.id) {
        await updateUser(existingPhone.id, { phone: null });
      }
    }

    const role = await findRoleBySlug(ROLES.DELIVERY_PARTNER);
    if (!role) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Role "delivery" is not configured.', {
        code: "ROLE_NOT_FOUND",
        expose: false,
      });
    }

    const password_hash = await hashPassword(input.password);

    let user;
    if (existingEmail && existingEmail.deleted_at) {
      // Resurrect a soft-deleted account instead of failing with "already exists".
      user = await updateUser(existingEmail.id, {
        name: input.name.trim(),
        phone: input.phone || null,
        password_hash,
        role: { connect: { id: role.id } },
        is_verified: true,
        email_verified_at: new Date(),
        provider: "local",
        provider_id: null,
        deleted_at: null,
        status: "ACTIVE",
        failed_login_attempts: 0,
        locked_until: null,
      });
    } else {
      user = await createUser({
        name: input.name.trim(),
        email,
        phone: input.phone || undefined,
        password_hash,
        role: { connect: { id: role.id } },
        is_verified: true,
        provider: "local",
      });
    }

    const profile = await prisma.deliveryProfile.upsert({
      where: { user_id: user.id },
      update: {
        vehicle_type: input.vehicle_type,
        vehicle_number: input.vehicle_number?.trim() || "NA",
        license_number: input.license_number?.trim() || "",
        status: "APPROVED",
        is_verified: true,
        is_available: false,
        availability_status: "OFFLINE",
        deleted_at: null,
      },
      create: {
        user_id: user.id,
        vehicle_type: input.vehicle_type,
        vehicle_number: input.vehicle_number?.trim() || "NA",
        license_number: input.license_number?.trim() || "",
        status: "APPROVED",
        is_verified: true,
        is_available: false,
        availability_status: "OFFLINE",
      },
    });

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.DELIVERY_CREATED,
        entityType: "delivery",
        entityId: profile.id,
        newValues: { email, vehicle_type: input.vehicle_type },
      },
      req
    );

    return {
      ...profile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        is_verified: user.is_verified,
      },
    };
  },

  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    status?: string;
    is_available?: string;
    vehicle_type?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await deliveryRepo.listDeliveryPartners(
      {
        q: query.q,
        status: query.status ? (query.status.toUpperCase() as import("@prisma/client").DeliveryStatus) : undefined,
        isAvailable: query.is_available === "true" ? true : query.is_available === "false" ? false : undefined,
        vehicleType: query.vehicle_type,
      },
      (page - 1) * perPage,
      perPage
    );
    const serialized = rows.map((p) => ({
      ...p,
      status: p.status.toLowerCase(),
      availability_status: p.availability_status.toLowerCase(),
    }));
    return { rows: serialized, total, page, perPage };
  },

  async getById(id: string) {
    const detail = await deliveryRepo.getDetail(id);
    if (!detail) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Delivery partner not found.", { code: "NOT_FOUND" });
    }
    return detail;
  },

  async review(adminUserId: string, id: string, decision: "approve" | "reject", reason: string | null, req: Request) {
    const partner = await deliveryRepo.findById(id);
    if (!partner) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Delivery partner not found.", { code: "NOT_FOUND" });
    }
    const updated = await deliveryRepo.updateDelivery(id, {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      is_verified: decision === "approve",
      ...(decision === "reject" ? { rejection_reason: reason } : { rejection_reason: null }),
    });
    await auditService.record(
      {
        userId: adminUserId,
        action: decision === "approve" ? AUDIT_ACTIONS.DELIVERY_APPROVED : AUDIT_ACTIONS.DELIVERY_REJECTED,
        entityType: "delivery_partner",
        entityId: id,
        newValues: { reason },
      },
      req
    );
    return updated;
  },

  async suspend(adminUserId: string, id: string, reason: string | null, req: Request) {
    const partner = await deliveryRepo.findById(id);
    if (!partner) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Delivery partner not found.", { code: "NOT_FOUND" });
    }
    const updated = await deliveryRepo.updateDelivery(id, {
      status: "SUSPENDED",
      is_available: false,
      availability_status: "OFFLINE",
      rejection_reason: reason,
    });
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.DELIVERY_SUSPENDED, entityType: "delivery_partner", entityId: id, newValues: { reason } },
      req
    );
    return updated;
  },

  async restore(adminUserId: string, id: string, req: Request) {
    const partner = await deliveryRepo.findById(id);
    if (!partner) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Delivery partner not found.", { code: "NOT_FOUND" });
    }
    const updated = await deliveryRepo.updateDelivery(id, {
      status: "APPROVED",
      is_verified: true,
      rejection_reason: null,
    });
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.DELIVERY_RESTORED, entityType: "delivery_partner", entityId: id },
      req
    );
    return updated;
  },
};
