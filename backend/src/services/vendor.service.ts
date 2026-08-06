import type { Request } from "express";
import { VendorStatus, Prisma } from "@prisma/client";

import log from "../config/logger";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as vendorRepo from "../repositories/vendor.repository";
import { findById as findUserById } from "../repositories/user.repository";
import { cacheService } from "../database/cache";
import { notificationService } from "./notification.service";
import { emailService } from "./email.service";
import { discoveryService } from "./discovery.service";
import { realtime } from "../realtime/realtime";
import { ApiError, ConflictError, ForbiddenError, NotFoundError } from "../utils/ApiError";
import * as roleRepo from "../repositories/role.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as refreshTokenRepo from "../repositories/refresh-token.repository";
import * as userRepo from "../repositories/user.repository";
import { boundingBox, haversineDistanceKm } from "../utils/geo";
import { HttpStatus } from "../utils/httpStatus";
import { uniqueSlug } from "../utils/slug";
import { deleteObject, extractKeyFromUrl } from "../storage/r2.client";
import prisma from "../database/prisma";
import { upsertSetting } from "../repositories/settings.repository";
import type {
  CreateVendorBody,
  UpdateVendorBody,
  VendorLocationBody,
  UpsertDailyLocationBody,
} from "../validators/vendor.validators";
import type { VendorKycBody, RingBellBody } from "../validators/integration.validators";
import type { CreateReviewBody } from "../validators/product.validators";
import * as dailyLocationRepo from "../repositories/vendor-daily-location.repository";
import { ROLES } from "../constants/roles";

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
      free_delivery_min_order: input.free_delivery_min_order ?? null,
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
    if (input.logo_url !== undefined) {
      if (input.logo_url !== vendor.logo_url && vendor.logo_url) {
        const key = extractKeyFromUrl(vendor.logo_url);
        if (key) await deleteObject(key).catch(() => {});
      }
      data.logo_url = input.logo_url || null;
    }
    if (input.banner_url !== undefined) {
      if (input.banner_url !== vendor.banner_url && vendor.banner_url) {
        const key = extractKeyFromUrl(vendor.banner_url);
        if (key) await deleteObject(key).catch(() => {});
      }
      data.banner_url = input.banner_url || null;
    }
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
    if (input.free_delivery_min_order !== undefined) data.free_delivery_min_order = input.free_delivery_min_order;
    if (input.owner_name !== undefined) data.owner_name = input.owner_name || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.available_from !== undefined) data.available_from = input.available_from || null;
    if (input.available_to !== undefined) data.available_to = input.available_to || null;
    if (input.roaming !== undefined) data.roaming = input.roaming;

    if (Object.keys(data).length > 0) {
      await vendorRepo.updateVendor(vendor.id, data as never);
    }

    if (input.subscription_plan) {
      await upsertSetting({ key: `vendor_subscription:${vendor.id}`, value: { plan: input.subscription_plan }, type: "json" });
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
    realtime.publishRoamingVendor(vendor.id, latitude, longitude);
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

  // ---------------------------------------------------------------------------
  // Daily Location (Location Broadcast)
  // ---------------------------------------------------------------------------

  async getMyDailyLocation(userId: string) {
    const vendor = await this.getMyVendor(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const location = await dailyLocationRepo.findByVendorAndDate(vendor.id, today);
    return {
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        slug: vendor.slug,
        roaming: vendor.roaming,
      },
      location,
    };
  },

  async upsertDailyLocation(
    userId: string,
    input: UpsertDailyLocationBody,
    req: Request,
  ) {
    const vendor = await this.getMyVendor(userId);

    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Vendor must be approved to broadcast location.", {
        code: "VENDOR_NOT_APPROVED",
      });
    }

    if (!vendor.roaming) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Only roaming vendors can set a daily broadcast location.", {
        code: "NOT_ROAMING_VENDOR",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const location = await dailyLocationRepo.upsert(vendor.id, today, {
      area: input.area,
      landmark: input.landmark ?? null,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      notes: input.notes ?? null,
      is_active: input.is_active ?? true,
    });

    await cacheService.invalidateNamespace("vendor");

    await discoveryService.recordLocationHistory(vendor.id, {
      area: location.area,
      landmark: location.landmark,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      start_time: location.start_time,
      end_time: location.end_time,
      notes: location.notes,
      is_active: location.is_active,
    });

    if (location.is_active) {
      realtime.publishRoamingVendor(vendor.id, location.latitude, location.longitude);
    }

    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.VENDOR_LOCATION_UPDATED,
        entityType: "vendor_daily_location",
        entityId: location.id,
        newValues: { area: location.area, latitude: location.latitude, longitude: location.longitude },
      },
      req,
    );

    return location;
  },

  async removeDailyLocation(userId: string) {
    const vendor = await this.getMyVendor(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await dailyLocationRepo.deleteByVendorAndDate(vendor.id, today);
    await cacheService.invalidateNamespace("vendor");
  },

  async getVendorDailyLocation(vendorId: string) {
    const vendor = await this.getById(vendorId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const location = await dailyLocationRepo.findByVendorAndDate(vendor.id, today);
    return {
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        slug: vendor.slug,
        category: vendor.category,
        logo_url: vendor.logo_url,
        rating: vendor.rating,
        review_count: vendor.review_count,
        is_verified: vendor.is_verified,
        roaming: vendor.roaming,
      },
      location,
    };
  },

  // ---------------------------------------------------------------------------
  // Vendor Dashboard
  // ---------------------------------------------------------------------------

  async getMyDashboard(userId: string) {
    const vendor = await this.getMyVendor(userId);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayOrders,
      totalOrders,
      todayRevenueAgg,
      totalRevenueAgg,
      pendingOrders,
      activeOrders,
      totalProducts,
      lowStockProducts,
      weeklyRevenueAgg,
      monthlyRevenueAgg,
      recentOrders,
      topProducts,
    ] = await Promise.all([
      prisma.order.count({
        where: { vendor_id: vendor.id, created_at: { gte: startOfDay }, deleted_at: null },
      }),
      prisma.order.count({
        where: { vendor_id: vendor.id, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      prisma.order.aggregate({
        where: {
          vendor_id: vendor.id,
          created_at: { gte: startOfDay },
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          vendor_id: vendor.id,
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        _sum: { total: true },
      }),
      prisma.order.count({
        where: { vendor_id: vendor.id, status: "PENDING", deleted_at: null },
      }),
      prisma.order.count({
        where: {
          vendor_id: vendor.id,
          status: { in: ["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP"] },
          deleted_at: null,
        },
      }),
      prisma.product.count({
        where: { vendor_id: vendor.id, deleted_at: null },
      }),
      prisma.product.count({
        where: {
          vendor_id: vendor.id,
          deleted_at: null,
          is_active: true,
          inventory: { some: { quantity: { lte: 5 } } },
        },
      }),
      prisma.order.aggregate({
        where: {
          vendor_id: vendor.id,
          created_at: { gte: startOfWeek },
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          vendor_id: vendor.id,
          created_at: { gte: startOfMonth },
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: { vendor_id: vendor.id, deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 10,
        select: {
          id: true,
          order_number: true,
          status: true,
          total: true,
          created_at: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.orderItem.groupBy({
        by: ["product_id"],
        where: {
          order: { vendor_id: vendor.id, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
        },
        _sum: { quantity: true },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    const topProductIds = topProducts.map((tp) => tp.product_id);
    const topProductDetails = topProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, price: true },
        })
      : [];

    const topProductsWithStats = topProducts.map((tp) => {
      const product = topProductDetails.find((p) => p.id === tp.product_id);
      return {
        product_id: tp.product_id,
        name: product?.name ?? "Unknown",
        price: product?.price,
        order_count: tp._count.id,
        total_quantity: tp._sum.quantity ?? 0,
      };
    });

    return {
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        rating: vendor.rating,
        review_count: vendor.review_count,
        is_open: vendor.is_open,
      },
      stats: {
        today_orders: todayOrders,
        total_orders: totalOrders,
        today_revenue: Number(todayRevenueAgg._sum?.total ?? 0),
        total_revenue: Number(totalRevenueAgg._sum?.total ?? 0),
        weekly_revenue: Number(weeklyRevenueAgg._sum?.total ?? 0),
        monthly_revenue: Number(monthlyRevenueAgg._sum?.total ?? 0),
        pending_orders: pendingOrders,
        active_orders: activeOrders,
        total_products: totalProducts,
        low_stock_products: lowStockProducts,
      },
      recent_orders: recentOrders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: Number(o.total),
        customer_name: o.customer?.name ?? "Customer",
        created_at: o.created_at,
      })),
      top_products: topProductsWithStats,
    };
  },

  async getMyReviews(userId: string) {
    const vendor = await this.getMyVendor(userId);
    const rows = await prisma.review.findMany({
      where: { product: { vendor_id: vendor.id }, deleted_at: null },
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        is_verified: true,
        created_at: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
          },
        },
        user: { select: { id: true, name: true, avatar_url: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      is_verified: r.is_verified,
      created_at: r.created_at,
      product: {
        id: r.product.id,
        name: r.product.name,
        slug: r.product.slug,
        image: r.product.images[0]?.url ?? null,
      },
      user: {
        id: r.user.id,
        name: r.user.name,
        avatar_url: r.user.avatar_url,
      },
    }));
  },

  async getNearbyWithDailyLocation(
    lat: number,
    lng: number,
    radiusKm: number,
    options: { category?: string; is_open?: boolean; page?: number; per_page?: number } = {},
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const radius = radiusKm || 5;
    const page = Math.max(1, options.page ?? 1);
    const perPage = Math.min(100, Math.max(1, options.per_page ?? 20));

    const key = `nearby_daily:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}:${options.category ?? ""}:${options.is_open ? "open" : "any"}:${page}:${perPage}`;

    const compute = () =>
      dailyLocationRepo.findNearby(lat, lng, radius, today, {
        category: options.category,
        is_open: options.is_open,
        page,
        per_page: perPage,
      });

    const cached = await cacheService.remember<{ items: dailyLocationRepo.NearbyDailyLocationResult[]; total: number }>(
      "vendor",
      key,
      compute,
    );

    return {
      items: cached?.items ?? [],
      total: cached?.total ?? 0,
      page,
      per_page: perPage,
    };
  },

  async cancelVendorApplication(userId: string, req: Request) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) {
      throw new NotFoundError("Vendor profile not found.");
    }
    const customerRole = await roleRepo.findBySlug(ROLES.CUSTOMER);
    if (!customerRole) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Customer role not configured.", { code: "ROLE_NOT_FOUND" });
    }
    await vendorRepo.softDelete(vendor.id);
    await userRepo.changeRole(userId, customerRole.id);
    await prisma.kycRecord.deleteMany({ where: { user_id: userId, type: "vendor" } });
    await sessionRepo.revokeAllForUser(userId);
    await refreshTokenRepo.revokeAllForUser(userId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.VENDOR_RESTORED, entityType: "vendor", entityId: vendor.id, newValues: { status: "cancelled", role_reverted: "customer" } },
      req
    );
    return { success: true, message: "Vendor application cancelled successfully." };
  },

  async submitVendorKyc(userId: string, input: VendorKycBody, req: Request) {
    await this.getMyVendor(userId);
    const kyc = await prisma.kycRecord.upsert({
      where: { user_id_type: { user_id: userId, type: "vendor" } },
      update: {
        documents: input as unknown as Prisma.InputJsonValue,
        status: "PENDING",
        rejection_reason: null,
      },
      create: {
        user_id: userId,
        type: "vendor",
        documents: input as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.KYC_SUBMITTED, entityType: "kyc", entityId: kyc.id, newValues: { type: "vendor", status: kyc.status } },
      req
    );
    return kyc;
  },

  async getVendorKyc(userId: string) {
    await this.getMyVendor(userId);
    const kyc = await prisma.kycRecord.findUnique({ where: { user_id_type: { user_id: userId, type: "vendor" } } });
    return kyc;
  },

  async getVendorEarnings(userId: string) {
    const vendor = await this.getMyVendor(userId);
    const stats = await vendorRepo.getVendorStats(vendor.id);
    const commission = stats.total_earnings.toNumber();
    const revenue = stats.total_revenue.toNumber();
    const [recent] = await Promise.all([
      prisma.order.findMany({
        where: { vendor_id: vendor.id, status: { notIn: ["CANCELLED", "FAILED"] } },
        orderBy: { created_at: "desc" },
        take: 8,
        select: {
          id: true,
          order_number: true,
          status: true,
          total: true,
          created_at: true,
        },
      }),
    ]);
    return {
      today_earnings: 0,
      total_orders: stats.total_orders,
      active_orders: stats.active_orders,
      total_revenue: Math.round(revenue * 100) / 100,
      total_commission: Math.round(commission * 100) / 100,
      total_payout: Math.round((revenue - commission) * 100) / 100,
      pending_payout: Math.round(stats.pending_earnings.toNumber() * 100) / 100,
      product_count: stats.product_count,
      out_of_stock_count: stats.out_of_stock_count,
      recent_transactions: recent.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status.toLowerCase(),
        total: o.total.toNumber(),
        created_at: o.created_at,
      })),
    };
  },

  async ringBell(vendorId: string, input: RingBellBody, req: Request) {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found.");
    }
    const name = (req as Request & { user?: { name?: string } }).user?.name ?? "Customer";
    const data = {
      address: input.address,
      note: input.note ?? null,
      customer_name: name,
    };
    realtime.publishVendorAlert(vendorId, data);
    await notificationService.vendor(
      vendor.user_id,
      "New Street Call",
      `${name} rang your bell from ${input.address}.`,
      { vendor_id: vendorId, kind: "gali_bell" }
    );
    await auditService.record(
      { userId: vendor.user_id, action: AUDIT_ACTIONS.GALI_BELL_RUNG, entityType: "vendor", entityId: vendorId, newValues: { address: input.address } },
      req
    );
    return { delivered: true };
  },

  async createReview(userId: string, vendorId: string, input: CreateReviewBody, req: Request) {
    const vendor = await vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found.");
    }

    const existing = await prisma.vendorReview.findFirst({
      where: { user_id: userId, vendor_id: vendorId, deleted_at: null },
    });
    if (existing) {
      throw new ConflictError("You have already reviewed this vendor.");
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.vendorReview.create({
        data: {
          user_id: userId,
          vendor_id: vendorId,
          order_id: input.order_id ?? null,
          rating: input.rating,
          title: input.title?.trim() || null,
          comment: input.comment?.trim() || null,
        },
      });

      const agg = await tx.vendorReview.aggregate({
        where: { vendor_id: vendorId, deleted_at: null },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.vendorProfile.update({
        where: { id: vendorId },
        data: {
          rating: agg._avg.rating ?? 0,
          review_count: agg._count.rating,
        },
      });

      return created;
    });

    await cacheService.invalidateNamespace("vendor");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.REVIEW_CREATED, entityType: "vendor", entityId: vendorId, newValues: { rating: input.rating } },
      req
    );

    return review;
  }
};
