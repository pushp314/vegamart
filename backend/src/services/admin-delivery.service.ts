import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as deliveryRepo from "../repositories/delivery.repository";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const adminDeliveryService = {
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
        status: query.status as import("@prisma/client").DeliveryStatus | undefined,
        isAvailable: query.is_available === "true" ? true : query.is_available === "false" ? false : undefined,
        vehicleType: query.vehicle_type,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
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
