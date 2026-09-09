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
import { Prisma } from "@prisma/client";

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
    const partnerIds = rows.map((p) => p.id);
    let codMap = new Map<string, number>();
    let approvedMap = new Map<string, number>();
    let pendingMap = new Map<string, number>();

    if (partnerIds.length > 0) {
      const [codOrdersByPartner, approvedSettlementsByPartner, pendingSettlementsByPartner] = await Promise.all([
        prisma.masterOrder.groupBy({
          by: ["delivery_partner_id"],
          where: {
            delivery_partner_id: { in: partnerIds },
            payment_method: "COD",
            payment_status: "PAID",
            status: { notIn: ["CANCELLED", "FAILED"] },
          },
          _sum: { total_amount: true },
        }),
        (prisma as any).deliveryCashSettlement.groupBy({
          by: ["delivery_partner_id"],
          where: {
            delivery_partner_id: { in: partnerIds },
            status: "APPROVED",
          },
          _sum: { amount: true },
        }),
        (prisma as any).deliveryCashSettlement.groupBy({
          by: ["delivery_partner_id"],
          where: {
            delivery_partner_id: { in: partnerIds },
            status: "PENDING",
          },
          _sum: { amount: true },
        }),
      ]);

      codMap = new Map(
        codOrdersByPartner
          .filter((c) => Boolean(c.delivery_partner_id))
          .map((c) => [c.delivery_partner_id!, Number(c._sum.total_amount ?? 0)])
      );
      approvedMap = new Map(
        approvedSettlementsByPartner
          .filter((a: any) => Boolean(a.delivery_partner_id))
          .map((a: any) => [a.delivery_partner_id!, Number(a._sum?.amount ?? 0)])
      );
      pendingMap = new Map(
        pendingSettlementsByPartner
          .filter((p: any) => Boolean(p.delivery_partner_id))
          .map((p: any) => [p.delivery_partner_id!, Number(p._sum?.amount ?? 0)])
      );
    }

    const serialized = rows.map((p) => {
      const codCollected = codMap.get(p.id) || 0;
      const settled = approvedMap.get(p.id) || 0;
      const currentCash = Math.max(0, Math.round((codCollected - settled) * 100) / 100);
      const maxLimit = Number((p as any).max_cash_in_hand ?? 3000);
      const pendingDeposit = pendingMap.get(p.id) || 0;

      return {
        ...p,
        status: p.status.toLowerCase(),
        availability_status: p.availability_status.toLowerCase(),
        cash_in_hand: {
          current: currentCash,
          max_limit: maxLimit,
          remaining: Math.max(0, Math.round((maxLimit - currentCash) * 100) / 100),
          is_blocked: currentCash >= maxLimit,
          pending_settlement: pendingDeposit,
          total_cod_collected: codCollected,
          total_settled: settled,
        },
      };
    });
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

  async updateCashLimit(adminUserId: string, id: string, maxCashInHand: number, req: Request) {
    const partner = await deliveryRepo.findById(id);
    if (!partner) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Delivery partner not found.", { code: "NOT_FOUND" });
    }
    const updated = await deliveryRepo.updateDelivery(id, {
      max_cash_in_hand: new Prisma.Decimal(maxCashInHand),
    } as any);
    await auditService.record(
      {
        userId: adminUserId,
        action: "DELIVERY_CASH_LIMIT_UPDATED",
        entityType: "delivery_partner",
        entityId: id,
        newValues: { max_cash_in_hand: maxCashInHand },
      },
      req
    );
    return updated;
  },
};
