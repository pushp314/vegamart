import prisma from "../database/prisma";
import type { Request } from "express";
import { VendorStatus } from "@prisma/client";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as vendorRepo from "../repositories/vendor.repository";
import { cacheService } from "../database/cache";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

interface KycDocuments {
  document_type?: string | null;
  document_number?: string | null;
  fssai_license?: string | null;
  gst_number?: string | null;
}

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
    const { rows, total } = await vendorRepo.listVendorsAdmin(
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
    const serialized = rows.map((v) => {
      const { user, ...vendor } = v;
      const kyc_records = user?.kyc_records ?? [];
      const kyc = kyc_records.length > 0 ? kyc_records[0] : null;
      const docs = (kyc?.documents ?? {}) as KycDocuments;
      return {
        ...vendor,
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
            }
          : null,
        kyc: kyc
          ? {
              status: kyc.status.toLowerCase(),
              document_type: docs.document_type ?? null,
              document_number: docs.document_number ?? null,
              fssai_license: docs.fssai_license ?? null,
              gst_number: docs.gst_number ?? null,
            }
          : null,
        status: vendor.status.toLowerCase(),
        vendor_type: vendor.roaming ? "roaming" : "shop",
      };
    });
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
  async updateMembership(
    vendorId: string,
    input: {
      commission_rate?: number;
      membership_tier?: string;
      membership_expires_at?: string | null;
    },
    adminId: string,
    req: Request
  ) {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }

    const updated = await prisma.vendorProfile.update({
      where: { id: vendorId },
      data: {
        commission_rate: input.commission_rate !== undefined ? input.commission_rate : vendor.commission_rate,
        membership_tier: input.membership_tier !== undefined ? input.membership_tier : vendor.membership_tier,
        membership_expires_at: input.membership_expires_at !== undefined ? (input.membership_expires_at ? new Date(input.membership_expires_at) : null) : vendor.membership_expires_at,
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });

    await auditService.record(
      {
        userId: adminId,
        action: "VENDOR_MEMBERSHIP_UPDATED",
        entityType: "vendor",
        entityId: vendorId,
        newValues: {
          commission_rate: updated.commission_rate,
          membership_tier: updated.membership_tier,
          membership_expires_at: updated.membership_expires_at,
        }
      },
      req
    );

    return updated;
  },
};
// Trigger IDE TS Server refresh
