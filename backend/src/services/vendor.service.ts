import type { Request } from "express";
import { VendorStatus } from "@prisma/client";

import log from "../config/logger";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as vendorRepo from "../repositories/vendor.repository";
import { findById as findUserById } from "../repositories/user.repository";
import { cacheService } from "../database/cache";
import { notificationService } from "./notification.service";
import { emailService } from "./email.service";
import { ApiError, ConflictError, ForbiddenError } from "../utils/ApiError";
import { boundingBox, haversineDistanceKm } from "../utils/geo";
import { HttpStatus } from "../utils/httpStatus";
import { uniqueSlug } from "../utils/slug";
import type {
  CreateVendorBody,
  UpdateVendorBody,
  VendorLocationBody,
} from "../validators/vendor.validators";

export interface NearbyVendor {
  vendor: Omit<vendorRepo.VendorRow, "latitude" | "longitude">;
  distance_km: number;
  latitude: number;
  longitude: number;
}

export const vendorService = {
  async ensureOwned(vendorId: string, userId: string): Promise<vendorRepo.VendorRow> {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }
    if (vendor.user_id !== userId) {
      throw new ForbiddenError("You do not own this vendor profile.");
    }
    return vendor;
  },

  async getMyVendor(userId: string): Promise<vendorRepo.VendorRow> {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor profile not found.", { code: "NOT_FOUND" });
    }
    return vendor;
  },

  async create(userId: string, input: CreateVendorBody, req: Request): Promise<vendorRepo.VendorRow> {
    const existing = await vendorRepo.findByUserId(userId);
    if (existing) {
      throw new ConflictError("You already have a vendor profile.");
    }

    const user = await findUserById(userId, { role: true });
    if (user?.role.slug !== "vendor") {
      throw new ForbiddenError("Only vendor accounts can create a vendor profile.");
    }

    const existingSlugs = await vendorRepo.listSlugs();
    const slug = uniqueSlug(input.business_name, existingSlugs);

    const vendor = await vendorRepo.createVendor({
      user_id: userId,
      business_name: input.business_name.trim(),
      slug,
      description: input.description ?? null,
      category: input.category ?? null,
      tags: input.tags ?? null,
      logo_url: input.logo_url ?? null,
      banner_url: input.banner_url ?? null,
      address: input.address.trim(),
      landmark: input.landmark ?? null,
      city: input.city.trim(),
      state: input.state.trim(),
      country: input.country ?? "India",
      pincode: input.pincode,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      delivery_radius_km: input.delivery_radius_km ?? 5,
      business_hours: input.business_hours ?? null,
      min_order: input.min_order ?? 0,
      delivery_fee: input.delivery_fee ?? 0,
      owner_name: input.owner_name ?? null,
      phone: input.phone ?? null,
      available_from: input.available_from ?? null,
      available_to: input.available_to ?? null,
      roaming: input.roaming ?? false,
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_REGISTERED, entityType: "vendor", entityId: vendor.id, newValues: { business_name: vendor.business_name, slug } },
      req
    );

    await cacheService.invalidateNamespace("vendor");
    return vendor;
  },

  async update(userId: string, input: UpdateVendorBody, req: Request): Promise<vendorRepo.VendorRow> {
    const vendor = await this.getMyVendor(userId);

    if (input.business_name && input.business_name.trim() !== vendor.business_name) {
      const existingSlugs = await vendorRepo.listSlugs(vendor.id);
      const slug = uniqueSlug(input.business_name.trim(), existingSlugs);
      const taken = await vendorRepo.findBySlug(slug);
      if (taken && taken.id !== vendor.id) {
        throw new ConflictError("A vendor with this business name already exists.");
      }
      await vendorRepo.updateVendor(vendor.id, { business_name: input.business_name.trim(), slug });
    }

    const data: Record<string, unknown> = {};
    if (input.business_name !== undefined) data.business_name = input.business_name.trim();
    if (input.description !== undefined) data.description = input.description || null;
    if (input.category !== undefined) data.category = input.category || null;
    if (input.tags !== undefined) data.tags = input.tags || null;
    if (input.logo_url !== undefined) data.logo_url = input.logo_url || null;
    if (input.banner_url !== undefined) data.banner_url = input.banner_url || null;
    if (input.address !== undefined) data.address = input.address.trim();
    if (input.landmark !== undefined) data.landmark = input.landmark || null;
    if (input.city !== undefined) data.city = input.city.trim();
    if (input.state !== undefined) data.state = input.state.trim();
    if (input.country !== undefined) data.country = input.country.trim();
    if (input.pincode !== undefined) data.pincode = input.pincode;
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (input.delivery_radius_km !== undefined) data.delivery_radius_km = input.delivery_radius_km;
    if (input.business_hours !== undefined) data.business_hours = input.business_hours || null;
    if (input.min_order !== undefined) data.min_order = input.min_order;
    if (input.delivery_fee !== undefined) data.delivery_fee = input.delivery_fee;
    if (input.owner_name !== undefined) data.owner_name = input.owner_name || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.available_from !== undefined) data.available_from = input.available_from || null;
    if (input.available_to !== undefined) data.available_to = input.available_to || null;
    if (input.roaming !== undefined) data.roaming = input.roaming;

    if (Object.keys(data).length > 0) {
      await vendorRepo.updateVendor(vendor.id, data as never);
    }

    const updated = await vendorRepo.findById(vendor.id);
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_UPDATED, entityType: "vendor", entityId: vendor.id, newValues: data },
      req
    );

    return updated!;
  },

  async setAvailability(userId: string, isOpen: boolean, req: Request): Promise<vendorRepo.VendorRow> {
    const vendor = await this.getMyVendor(userId);
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Vendor must be approved before opening.", {
        code: "VENDOR_NOT_APPROVED",
      });
    }
    const updated = await vendorRepo.updateVendor(vendor.id, { is_open: isOpen });
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_STATUS_TOGGLED, entityType: "vendor", entityId: vendor.id, newValues: { is_open: isOpen } },
      req
    );
    return updated;
  },

  async setLocation(
    userId: string,
    latitude: number,
    longitude: number,
    req: Request
  ): Promise<vendorRepo.VendorRow> {
    const vendor = await this.getMyVendor(userId);
    const updated = await vendorRepo.updateVendor(vendor.id, { latitude, longitude });
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_LOCATION_UPDATED, entityType: "vendor", entityId: vendor.id, newValues: { latitude, longitude } },
      req
    );
    return updated;
  },

  async updateLocation(
    userId: string,
    input: VendorLocationBody,
    req: Request
  ): Promise<vendorRepo.VendorRow> {
    const vendor = await this.getMyVendor(userId);

    const data: Record<string, unknown> = {};
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (input.address !== undefined) data.address = input.address.trim();
    if (input.landmark !== undefined) data.landmark = input.landmark || null;
    if (input.city !== undefined) data.city = input.city.trim();
    if (input.state !== undefined) data.state = input.state.trim();
    if (input.country !== undefined) data.country = input.country.trim();
    if (input.pincode !== undefined) data.pincode = input.pincode;
    if (input.delivery_radius_km !== undefined) data.delivery_radius_km = input.delivery_radius_km;

    if (Object.keys(data).length === 0) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "No location fields to update.", {
        code: "VALIDATION_ERROR",
      });
    }

    const updated = await vendorRepo.updateVendor(vendor.id, data as never);
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_LOCATION_UPDATED, entityType: "vendor", entityId: vendor.id, newValues: data },
      req
    );
    return updated;
  },

  async getMyLocation(userId: string) {
    const vendor = await this.getMyVendor(userId);
    return this.locationPayload(vendor);
  },

  async getLocationById(vendorId: string) {
    const vendor = await this.getById(vendorId);
    return this.locationPayload(vendor);
  },

  locationPayload(vendor: vendorRepo.VendorRow) {
    return {
      latitude: vendor.latitude,
      longitude: vendor.longitude,
      address: vendor.address,
      landmark: vendor.landmark,
      city: vendor.city,
      state: vendor.state,
      country: vendor.country,
      pincode: vendor.pincode,
      delivery_radius_km: vendor.delivery_radius_km,
    };
  },

  async setHours(
    userId: string,
    businessHours: string,
    availableFrom: string | null,
    availableTo: string | null,
    req: Request
  ): Promise<vendorRepo.VendorRow> {
    const vendor = await this.getMyVendor(userId);
    const updated = await vendorRepo.updateVendor(vendor.id, {
      business_hours: businessHours,
      available_from: availableFrom,
      available_to: availableTo,
    });
    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_UPDATED, entityType: "vendor", entityId: vendor.id, newValues: { business_hours: businessHours } },
      req
    );
    return updated;
  },

  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    city?: string;
    category?: string;
    is_open?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const cacheable = !query.q && page <= 5;
    const key = `list:${page}:${perPage}:${query.city ?? ""}:${query.category ?? ""}:${query.is_open ?? ""}`;
    const load = () =>
      vendorRepo.listVendors(
        {
          q: query.q,
          city: query.city,
          category: query.category,
          isOpen: query.is_open === "true" ? true : query.is_open === "false" ? false : undefined,
        },
        (page - 1) * perPage,
        perPage
      );

    if (!cacheable) {
      const { rows, total } = await load();
      return { rows, total, page, perPage };
    }

    const cached = await cacheService.remember<{ rows: vendorRepo.VendorRow[]; total: number }>("vendor", key, load);
    return { rows: cached?.rows ?? [], total: cached?.total ?? 0, page, perPage };
  },

  async nearby(
    lat: number,
    lng: number,
    radiusKm: number,
    options: { category?: string; isOpen?: boolean; page?: number; perPage?: number } = {}
  ): Promise<{ vendors: NearbyVendor[]; total: number; page: number; perPage: number }> {
    const radius = radiusKm || 5;
    const page = Math.max(1, options.page ?? 1);
    const perPage = Math.min(100, Math.max(1, options.perPage ?? 20));
    const bounds = boundingBox(lat, lng, radius);
    const key = `nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}:${options.category ?? ""}:${options.isOpen ? "open" : "any"}:${page}:${perPage}`;
    const compute = async (): Promise<{ vendors: NearbyVendor[]; total: number }> => {
      const vendors = await vendorRepo.listWithinBoundingBox(bounds, options.isOpen === true);

      const results: NearbyVendor[] = [];
      for (const vendor of vendors) {
        if (options.category && !vendor.category?.toLowerCase().includes(options.category.toLowerCase())) {
          continue;
        }
        if (vendor.latitude === null || vendor.longitude === null) {
          continue;
        }
        const distance = haversineDistanceKm(lat, lng, vendor.latitude, vendor.longitude);
        if (distance > radius) {
          continue;
        }
        if (vendor.delivery_radius_km < distance) {
          continue;
        }
        const { latitude, longitude, ...rest } = vendor;
        results.push({ vendor: rest, distance_km: distance, latitude, longitude });
      }

      results.sort((a, b) => a.distance_km - b.distance_km);
      const total = results.length;
      const start = (page - 1) * perPage;
      return { vendors: results.slice(start, start + perPage), total };
    };

    const cached = await cacheService.remember<{ vendors: NearbyVendor[]; total: number }>("vendor", key, compute);
    return { vendors: cached?.vendors ?? [], total: cached?.total ?? 0, page, perPage };
  },

  async getById(id: string): Promise<vendorRepo.VendorRow> {
    const vendor = await cacheService.remember<vendorRepo.VendorRow>("vendor", `detail:${id}`, async () => {
      const found = await vendorRepo.findById(id);
      if (!found) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
      }
      return found;
    });
    return vendor as vendorRepo.VendorRow;
  },

  async getBySlug(slug: string): Promise<vendorRepo.VendorRow> {
    const vendor = await cacheService.remember<vendorRepo.VendorRow>("vendor", `slug:${slug}`, async () => {
      const found = await vendorRepo.findBySlug(slug);
      if (!found || found.status !== VendorStatus.APPROVED) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
      }
      return found;
    });
    return vendor as vendorRepo.VendorRow;
  },

  async review(userId: string, vendorId: string, decision: "approve" | "reject", reason: string | null, req: Request): Promise<vendorRepo.VendorRow> {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }

    if (decision === "approve") {
      const updated = await vendorRepo.updateVendor(vendorId, {
        status: "APPROVED",
        is_verified: true,
        rejection_reason: null,
      });
      await auditService.record(
        { userId, action: AUDIT_ACTIONS.VENDOR_APPROVED, entityType: "vendor", entityId: vendorId },
        req
      );
      await this.notifyDecision(vendor, true, null);
      return updated;
    }

    const updated = await vendorRepo.updateVendor(vendorId, {
      status: "REJECTED",
      is_verified: false,
      rejection_reason: reason,
    });
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_REJECTED, entityType: "vendor", entityId: vendorId, newValues: { reason } },
      req
    );
    await this.notifyDecision(vendor, false, reason);
    return updated;
  },

  async notifyDecision(vendor: vendorRepo.VendorRow, approved: boolean, reason: string | null): Promise<void> {
    try {
      const user = await findUserById(vendor.user_id);
      if (user?.email) {
        if (approved) {
          await emailService.sendVendorApproved(user.email, {
            name: user.name,
            businessName: vendor.business_name,
          });
        } else {
          await emailService.sendVendorRejected(user.email, {
            name: user.name,
            businessName: vendor.business_name,
            reason,
          });
        }
      }
      await notificationService.vendor(
        vendor.user_id,
        approved ? "Vendor application approved" : "Vendor application rejected",
        approved
          ? `${vendor.business_name} has been approved. You can now start accepting orders.`
          : `${vendor.business_name} was not approved${reason ? `: ${reason}` : ""}.`,
        { vendor_id: vendor.id, status: approved ? "approved" : "rejected" }
      );
    } catch (error) {
      log.error(`[vendor] Failed to notify decision for ${vendor.id}`, {
        context: "vendor",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async suspend(userId: string, vendorId: string, req: Request): Promise<vendorRepo.VendorRow> {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }
    const updated = await vendorRepo.updateVendor(vendorId, {
      status: "SUSPENDED",
      is_open: false,
    });
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_SUSPENDED, entityType: "vendor", entityId: vendorId },
      req
    );
    return updated;
  },
};
