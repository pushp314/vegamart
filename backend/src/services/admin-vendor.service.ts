import type { Request } from "express";
import { VendorStatus } from "@prisma/client";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as vendorRepo from "../repositories/vendor.repository";
import { cacheService } from "../database/cache";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const adminVendorService = {
  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    city?: string;
    category?: string;
    status?: VendorStatus;
    is_open?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await vendorRepo.listVendors(
      {
        q: query.q,
        city: query.city,
        category: query.category,
        status: query.status,
        includeAll: true,
        isOpen: query.is_open === "true" ? true : query.is_open === "false" ? false : undefined,
      },
      (page - 1) * perPage,
      perPage
    );
    const serialized = rows.map((v) => ({
      ...v,
      status: v.status.toLowerCase(),
      vendor_type: v.roaming ? "roaming" : "shop",
    }));
    return { rows: serialized, total, page, perPage };
  },

  async getById(id: string) {
    const detail = await vendorRepo.getVendorDetail(id);
    if (!detail) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }
    const stats = await vendorRepo.getVendorStats(id);
    return { vendor: detail, stats };
  },

  async review(adminUserId: string, vendorId: string, decision: "approve" | "reject", reason: string | null, req: Request) {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }
    const updated = await vendorRepo.updateVendor(vendorId, {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      is_verified: decision === "approve",
      ...(decision === "reject" ? { rejection_reason: reason } : { rejection_reason: null }),
    });
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      {
        userId: adminUserId,
        action: decision === "approve" ? AUDIT_ACTIONS.VENDOR_APPROVED : AUDIT_ACTIONS.VENDOR_REJECTED,
        entityType: "vendor",
        entityId: vendorId,
        newValues: { reason },
      },
      req
    );
    return updated;
  },

  async suspend(adminUserId: string, vendorId: string, reason: string | null, req: Request) {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }
    const updated = await vendorRepo.updateVendor(vendorId, {
      status: "SUSPENDED",
      is_open: false,
      rejection_reason: reason,
    });
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.VENDOR_SUSPENDED, entityType: "vendor", entityId: vendorId, newValues: { reason } },
      req
    );
    return updated;
  },

  async restore(adminUserId: string, vendorId: string, req: Request) {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }
    const updated = await vendorRepo.restore(vendorId);
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.VENDOR_RESTORED, entityType: "vendor", entityId: vendorId },
      req
    );
    return updated;
  },

  async earnings(vendorId: string) {
    await this.getById(vendorId);
    const rows = await vendorRepo.getVendorStats(vendorId);
    return rows;
  },
};
