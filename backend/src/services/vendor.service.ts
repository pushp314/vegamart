import type { Request } from "express";
import { VendorStatus, Prisma } from "@prisma/client";
import { parse } from 'csv-parse/sync';

import log from "../config/logger";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as vendorRepo from "../repositories/vendor.repository";
import * as productRepo from "../repositories/product.repository";
import { existsById as categoryExists } from "../repositories/category.repository";
import { listVendorEarningsRecent } from "./earning.service";
import { findById as findUserById, update as updateUser } from "../repositories/user.repository";
import { findBySlug as findRoleBySlug } from "../repositories/role.repository";
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
import { membershipPlanService } from "./membership-plan.service";
import { payoutService } from "./payout.service";
import { subscriptionPaymentService } from "./subscription-payment.service";

export interface NearbyVendor {
  vendor: Omit<vendorRepo.VendorRow, "latitude" | "longitude">;
  distance_km: number;
  latitude: number;
  longitude: number;
}

export interface DeliveryOptionConfig {
  enabled: boolean;
  min_order: number;
  delivery_fee: number;
  estimated_time: string;
  online_payment_enabled: boolean;
  cod_enabled: boolean;
  full_payment_enabled: boolean;
  advance_payment_enabled: boolean;
  advance_percentage: number;
}

export interface VendorDeliveryConfigs {
  estimated_delivery_time?: string;
  booking: DeliveryOptionConfig;
  self_pickup: DeliveryOptionConfig;
  shop_delivery: DeliveryOptionConfig;
  delivery_partner: DeliveryOptionConfig;
}

function toNum(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  if (typeof val === "object" && typeof val.toNumber === "function") {
    const num = val.toNumber();
    return isNaN(num) ? fallback : num;
  }
  const parsed = Number(val);
  return isNaN(parsed) ? fallback : parsed;
}

function toBool(val: any, fallback: boolean): boolean {
  if (val === undefined || val === null) return fallback;
  return Boolean(val);
}

export function normalizeDeliveryConfigs(
  rawConfigs: any,
  fallbackVendor?: {
    provides_delivery?: boolean;
    delivery_fee?: any;
    advance_payment_percentage?: any;
    min_order?: any;
    estimated_delivery_time?: any;
  }
): VendorDeliveryConfigs {
  const configs = (rawConfigs && typeof rawConfigs === "object") ? rawConfigs : {};
  const defaultAdvance = toNum(fallbackVendor?.advance_payment_percentage, 10);
  const defaultMinOrder = toNum(fallbackVendor?.min_order, 0);
  const defaultDeliveryFee = toNum(fallbackVendor?.delivery_fee, 0);
  const defaultShopDeliveryEnabled = Boolean(fallbackVendor?.provides_delivery);

  return {
    ...(configs.estimated_delivery_time || fallbackVendor?.estimated_delivery_time
      ? { estimated_delivery_time: configs.estimated_delivery_time || fallbackVendor?.estimated_delivery_time }
      : {}),
    booking: {
      enabled: configs.booking?.enabled !== undefined ? Boolean(configs.booking.enabled) : false,
      advance_percentage: configs.booking?.advance_percentage !== undefined ? toNum(configs.booking.advance_percentage, defaultAdvance || 20) : (defaultAdvance || 20),
      min_order: configs.booking?.min_order !== undefined ? toNum(configs.booking.min_order, defaultMinOrder) : defaultMinOrder,
      delivery_fee: 0,
      estimated_time: configs.booking?.estimated_time || "1-2 days",
      online_payment_enabled: toBool(configs.booking?.online_payment_enabled, true),
      cod_enabled: toBool(configs.booking?.cod_enabled, false),
      full_payment_enabled: toBool(configs.booking?.full_payment_enabled, true),
      advance_payment_enabled: toBool(configs.booking?.advance_payment_enabled, true),
    },
    self_pickup: {
      enabled: configs.self_pickup?.enabled !== undefined ? Boolean(configs.self_pickup.enabled) : true,
      advance_percentage: configs.self_pickup?.advance_percentage !== undefined ? toNum(configs.self_pickup.advance_percentage, defaultAdvance || 10) : (defaultAdvance || 10),
      min_order: configs.self_pickup?.min_order !== undefined ? toNum(configs.self_pickup.min_order, defaultMinOrder) : defaultMinOrder,
      delivery_fee: 0,
      estimated_time: configs.self_pickup?.estimated_time || "15 mins",
      online_payment_enabled: toBool(configs.self_pickup?.online_payment_enabled, true),
      cod_enabled: toBool(configs.self_pickup?.cod_enabled, true),
      full_payment_enabled: toBool(configs.self_pickup?.full_payment_enabled, true),
      advance_payment_enabled: toBool(configs.self_pickup?.advance_payment_enabled, true),
    },
    shop_delivery: {
      enabled: configs.shop_delivery?.enabled !== undefined ? Boolean(configs.shop_delivery.enabled) : defaultShopDeliveryEnabled,
      delivery_fee: configs.shop_delivery?.delivery_fee !== undefined ? toNum(configs.shop_delivery.delivery_fee, defaultDeliveryFee) : defaultDeliveryFee,
      min_order: configs.shop_delivery?.min_order !== undefined ? toNum(configs.shop_delivery.min_order, defaultMinOrder) : defaultMinOrder,
      estimated_time: configs.shop_delivery?.estimated_time || "30-45 mins",
      online_payment_enabled: toBool(configs.shop_delivery?.online_payment_enabled, true),
      cod_enabled: toBool(configs.shop_delivery?.cod_enabled, true),
      full_payment_enabled: toBool(configs.shop_delivery?.full_payment_enabled, true),
      advance_payment_enabled: toBool(configs.shop_delivery?.advance_payment_enabled, false),
      advance_percentage: configs.shop_delivery?.advance_percentage !== undefined ? toNum(configs.shop_delivery.advance_percentage, 20) : 20,
    },
    delivery_partner: {
      enabled: configs.delivery_partner?.enabled !== undefined ? Boolean(configs.delivery_partner.enabled) : true,
      delivery_fee: configs.delivery_partner?.delivery_fee !== undefined ? toNum(configs.delivery_partner.delivery_fee, 0) : 0,
      min_order: configs.delivery_partner?.min_order !== undefined ? toNum(configs.delivery_partner.min_order, 0) : 0,
      estimated_time: configs.delivery_partner?.estimated_time || "20-30 mins",
      online_payment_enabled: toBool(configs.delivery_partner?.online_payment_enabled, true),
      cod_enabled: toBool(configs.delivery_partner?.cod_enabled, true),
      full_payment_enabled: toBool(configs.delivery_partner?.full_payment_enabled, true),
      advance_payment_enabled: toBool(configs.delivery_partner?.advance_payment_enabled, false),
      advance_percentage: configs.delivery_partner?.advance_percentage !== undefined ? toNum(configs.delivery_partner.advance_percentage, 20) : 20,
    },
  };
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
    
    if (user?.role.slug === "customer") {
      const vendorRole = await findRoleBySlug("vendor");
      if (vendorRole) {
        await updateUser(userId, { role: { connect: { id: vendorRole.id } } });
      }
    } else if (user?.role.slug !== "vendor" && user?.role.slug !== "admin") {
      throw new ForbiddenError("Your account type cannot create a vendor profile.");
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
      provides_delivery: input.provides_delivery ?? false,
      owner_name: input.owner_name ?? null,
      phone: input.phone ?? null,
      available_from: input.available_from ?? null,
      available_to: input.available_to ?? null,
      roaming: input.roaming ?? false,
      estimated_delivery_time: input.estimated_delivery_time ?? null,
      delivery_configs: input.delivery_configs ?? null,
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
    if (input.provides_delivery !== undefined) data.provides_delivery = input.provides_delivery;
    if (input.delivery_options !== undefined) data.delivery_options = input.delivery_options;
    if (input.delivery_configs !== undefined) {
      data.delivery_configs = input.delivery_configs;
      const normalized = normalizeDeliveryConfigs(input.delivery_configs, vendor);
      data.provides_delivery = normalized.shop_delivery.enabled;
      data.delivery_fee = normalized.shop_delivery.delivery_fee;
      data.advance_payment_percentage = normalized.self_pickup.advance_percentage;
    }
    if (input.advance_payment_percentage !== undefined) data.advance_payment_percentage = input.advance_payment_percentage;
    if (input.tax_rate !== undefined) data.tax_rate = input.tax_rate;
    if (input.banner_urls !== undefined) {
      data.banner_urls = input.banner_urls;
      if (input.banner_url === undefined) {
        data.banner_url = input.banner_urls[0] || null;
      }
    }
    if (input.owner_name !== undefined) data.owner_name = input.owner_name || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.available_from !== undefined) data.available_from = input.available_from || null;
    if (input.available_to !== undefined) data.available_to = input.available_to || null;
    if (input.estimated_delivery_time !== undefined) {
      data.estimated_delivery_time = input.estimated_delivery_time || null;
    }
    if (input.bank_account_number !== undefined) data.bank_account_number = input.bank_account_number || null;
    if (input.bank_ifsc !== undefined) data.bank_ifsc = input.bank_ifsc ? input.bank_ifsc.toUpperCase() : null;
    if (input.bank_account_holder_name !== undefined) data.bank_account_holder_name = input.bank_account_holder_name || null;
    if (input.bank_name !== undefined) data.bank_name = input.bank_name || null;
    if (input.upi_id !== undefined) data.upi_id = input.upi_id || null;
    if (input.payout_enabled !== undefined) data.payout_enabled = input.payout_enabled;

    if (Object.keys(data).length > 0) {
      await vendorRepo.updateVendor(vendor.id, data as never);
    }

    if (input.bank_account_number || input.bank_ifsc || input.bank_account_holder_name) {
      await payoutService.syncVendorLinkedAccount(vendor.id, {
        bank_account_number: (input.bank_account_number as string) ?? undefined,
        bank_ifsc: (input.bank_ifsc as string) ?? undefined,
        bank_account_holder_name: (input.bank_account_holder_name as string) ?? undefined,
      }).catch(() => {});
    }

    if (input.subscription_plan) {
      await upsertSetting({ key: `vendor_subscription:${vendor.id}`, value: { plan: input.subscription_plan }, type: "json" });
    }

    const updated = await vendorRepo.findById(vendor.id);
    await cacheService.invalidateNamespace("vendor");
    await cacheService.invalidateNamespace("product");
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
    await cacheService.invalidateNamespace("product");
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
    category_id?: string;
    is_open?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const cacheable = !query.q && page <= 5;
    const key = `list:${page}:${perPage}:${query.city ?? ""}:${query.category ?? ""}:${query.category_id ?? ""}:${query.is_open ?? ""}`;
    const load = () =>
      vendorRepo.listVendors(
        {
          q: query.q,
          city: query.city,
          category: query.category,
          category_id: query.category_id,
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

  async getMyMembership(userId: string) {
    const vendor = await this.getMyVendor(userId);
    return membershipPlanService.getMyMembership(vendor.id);
  },

  async purchaseMembership(userId: string, planId: string, req: Request) {
    const vendor = await this.getMyVendor(userId);
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Vendor must be approved before purchasing a membership.", {
        code: "VENDOR_NOT_APPROVED",
      });
    }

    const plan = await membershipPlanService.getPlan(planId);
    if (!plan.is_active) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This membership plan is not available.", {
        code: "PLAN_INACTIVE",
      });
    }

    const isFree = Number(plan.price) === 0;
    if (!isFree) {
      const checkout = await subscriptionPaymentService.initiate(vendor.id, plan);
      await auditService.record(
        {
          userId,
          action: "VENDOR_MEMBERSHIP_CHECKOUT_INITIATED",
          entityType: "vendor",
          entityId: vendor.id,
          newValues: { membership_plan_id: plan.id, membership_tier: plan.slug },
        },
        req
      );
      return { checkout, plan: { id: plan.id, name: plan.name, slug: plan.slug, price: Number(plan.price) } };
    }

    await membershipPlanService.applyPlanToVendor(vendor.id, plan.id, {});
    await cacheService.invalidateNamespace("vendor");
    await cacheService.invalidateNamespace("product");

    const membership = await membershipPlanService.getMyMembership(vendor.id);
    const expiryLabel = membership.expires_at
      ? ` until ${new Date(membership.expires_at).toLocaleDateString()}`
      : "";
    await notificationService.vendor(
      vendor.user_id,
      `Membership activated: ${plan.name}`,
      `Your ${plan.name} plan is now active${expiryLabel}. Enjoy your new features.`,
      {
        vendor_id: vendor.id,
        plan_id: plan.id,
        tier: plan.slug,
        expires_at: membership.expires_at?.toISOString() ?? null,
      }
    );

    await auditService.record(
      {
        userId,
        action: "VENDOR_MEMBERSHIP_PURCHASED",
        entityType: "vendor",
        entityId: vendor.id,
        newValues: { membership_plan_id: plan.id, membership_tier: plan.slug },
      },
      req
    );

    return { membership };
  },

  async verifyMembershipPayment(
    userId: string,
    input: { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string },
    req: Request
  ) {
    const vendor = await this.getMyVendor(userId);
    return subscriptionPaymentService.verifyAndActivate(vendor.id, input, req);
  },

  async cancelMembership(userId: string, req: Request) {
    const vendor = await this.getMyVendor(userId);
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Vendor must be approved.", {
        code: "VENDOR_NOT_APPROVED",
      });
    }

    await subscriptionPaymentService.cancelPaidSubscription(vendor.id);
    await cacheService.invalidateNamespace("vendor");
    await cacheService.invalidateNamespace("product");

    await notificationService.vendor(
      vendor.user_id,
      "Membership canceled",
      "Your paid membership has been canceled. Your store is now on the basic plan.",
      { vendor_id: vendor.id, plan_id: null, tier: "basic" }
    );

    await auditService.record(
      {
        userId,
        action: "VENDOR_MEMBERSHIP_CANCELED",
        entityType: "vendor",
        entityId: vendor.id,
        newValues: { membership_plan_id: null, membership_tier: "basic" },
      },
      req
    );

    return membershipPlanService.getMyMembership(vendor.id);
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
      // @ts-ignore - Prisma types might be stale in IDE
      const subscribers = await prisma.userSubscription.findMany({
        where: { vendor_id: vendor.id },
      });
      for (const sub of subscribers) {
        await notificationService.vendor(
          sub.user_id,
          "Your Favorite Vendor is Live! 🔔",
          `${vendor.business_name || 'A vendor you follow'} just went live at ${location.area}. Check out their fresh produce now!`,
          { vendor_id: vendor.id, location_id: location.id }
        );
      }
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
    const membership = await membershipPlanService.getMyMembership(vendor.id);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

    const commissionRate = Number((vendor as any).commission_rate ?? 5);

    const [
      todayOrders,
      weeklyOrders,
      monthlyOrders,
      yearlyOrders,
      totalOrders,
      todayRevenueAgg,
      weeklyRevenueAgg,
      monthlyRevenueAgg,
      yearlyRevenueAgg,
      totalRevenueAgg,
      pendingOrders,
      activeOrders,
      totalProducts,
      lowStockProducts,
      recentOrders,
      topProducts,
      todayOrderCounter,
      customerGroups,
      totalItemsSoldAgg,
      todayItemsSoldAgg,
      weeklyItemsSoldAgg,
      monthlyItemsSoldAgg,
      yearlyItemsSoldAgg,
      storeViewsAgg,
      todayViewsAgg,
      weeklyViewsAgg,
      monthlyViewsAgg,
      yearlyViewsAgg,
      allYearOrders,
    ] = await Promise.all([
      // Orders counts
      prisma.order.count({
        where: { vendor_id: vendor.id, created_at: { gte: startOfToday }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      prisma.order.count({
        where: { vendor_id: vendor.id, created_at: { gte: startOfWeek }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      prisma.order.count({
        where: { vendor_id: vendor.id, created_at: { gte: startOfMonth }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      prisma.order.count({
        where: { vendor_id: vendor.id, created_at: { gte: startOfYear }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      prisma.order.count({
        where: { vendor_id: vendor.id, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
      }),
      // Revenues
      prisma.order.aggregate({
        where: { vendor_id: vendor.id, created_at: { gte: startOfToday }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { vendor_id: vendor.id, created_at: { gte: startOfWeek }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { vendor_id: vendor.id, created_at: { gte: startOfMonth }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { vendor_id: vendor.id, created_at: { gte: startOfYear }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { vendor_id: vendor.id, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } },
        _sum: { total: true },
      }),
      // Status counts
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
      // Product counts
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
      // Recent orders
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
      // Top products
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
      // Today order counter
      prisma.dailyOrderCounter.findUnique({
        where: {
          vendor_id_date: {
            vendor_id: vendor.id,
            date: startOfToday,
          },
        },
      }),
      // Customer breakdown
      prisma.order.groupBy({
        by: ["user_id"],
        where: {
          vendor_id: vendor.id,
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        _count: { id: true },
      }),
      // Items sold
      prisma.orderItem.aggregate({
        where: { order: { vendor_id: vendor.id, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } } },
        _sum: { quantity: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: { vendor_id: vendor.id, created_at: { gte: startOfToday }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } } },
        _sum: { quantity: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: { vendor_id: vendor.id, created_at: { gte: startOfWeek }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } } },
        _sum: { quantity: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: { vendor_id: vendor.id, created_at: { gte: startOfMonth }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } } },
        _sum: { quantity: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: { vendor_id: vendor.id, created_at: { gte: startOfYear }, deleted_at: null, status: { notIn: ["CANCELLED", "FAILED"] } } },
        _sum: { quantity: true },
      }),
      // Store views
      prisma.storeAnalytics.aggregate({
        where: { vendor_id: vendor.id },
        _sum: { store_views: true },
      }),
      prisma.storeAnalytics.aggregate({
        where: { vendor_id: vendor.id, date: { gte: startOfToday } },
        _sum: { store_views: true },
      }),
      prisma.storeAnalytics.aggregate({
        where: { vendor_id: vendor.id, date: { gte: startOfWeek } },
        _sum: { store_views: true },
      }),
      prisma.storeAnalytics.aggregate({
        where: { vendor_id: vendor.id, date: { gte: startOfMonth } },
        _sum: { store_views: true },
      }),
      prisma.storeAnalytics.aggregate({
        where: { vendor_id: vendor.id, date: { gte: startOfYear } },
        _sum: { store_views: true },
      }),
      // Year orders for historical graphs
      prisma.order.findMany({
        where: {
          vendor_id: vendor.id,
          created_at: { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
          deleted_at: null,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
        select: {
          id: true,
          created_at: true,
          total: true,
          items: { select: { quantity: true } },
        },
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

    const todayRev = Number(todayRevenueAgg._sum?.total ?? 0);
    const weeklyRev = Number(weeklyRevenueAgg._sum?.total ?? 0);
    const monthlyRev = Number(monthlyRevenueAgg._sum?.total ?? 0);
    const yearlyRev = Number(yearlyRevenueAgg._sum?.total ?? 0);
    const totalRev = Number(totalRevenueAgg._sum?.total ?? 0);

    const calcCommission = (rev: number) => {
      const comm = Math.round(rev * (commissionRate / 100) * 100) / 100;
      const net = Math.max(0, Math.round((rev - comm) * 100) / 100);
      return { commission: comm, net_earnings: net };
    };

    const todayComm = calcCommission(todayRev);
    const weeklyComm = calcCommission(weeklyRev);
    const monthlyComm = calcCommission(monthlyRev);
    const yearlyComm = calcCommission(yearlyRev);
    const totalComm = calcCommission(totalRev);

    const totalCustomers = customerGroups.length;
    const newCustomers = customerGroups.filter((c) => c._count.id === 1).length;
    const returningCustomers = customerGroups.filter((c) => c._count.id > 1).length;

    const totalItemsSold = totalItemsSoldAgg._sum?.quantity ?? 0;
    const todayItemsSold = todayItemsSoldAgg._sum?.quantity ?? 0;
    const weeklyItemsSold = weeklyItemsSoldAgg._sum?.quantity ?? 0;
    const monthlyItemsSold = monthlyItemsSoldAgg._sum?.quantity ?? 0;
    const yearlyItemsSold = yearlyItemsSoldAgg._sum?.quantity ?? 0;

    const totalStoreViews = storeViewsAgg._sum?.store_views ?? 0;
    const todayStoreViews = todayViewsAgg._sum?.store_views ?? 0;
    const weeklyStoreViews = weeklyViewsAgg._sum?.store_views ?? 0;
    const monthlyStoreViews = monthlyViewsAgg._sum?.store_views ?? 0;
    const yearlyStoreViews = yearlyViewsAgg._sum?.store_views ?? 0;

    // 1. Day Chart (Last 7 Days)
    const dayChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

      const dayOrders = allYearOrders.filter((o) => o.created_at.toISOString().split("T")[0] === dayStr);
      const rev = dayOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const itemsCount = dayOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
      const comm = Math.round(rev * (commissionRate / 100) * 100) / 100;
      const net = Math.max(0, Math.round((rev - comm) * 100) / 100);

      dayChart.push({
        date: dayStr,
        label,
        revenue: Math.round(rev * 100) / 100,
        orders: dayOrders.length,
        items_sold: itemsCount,
        commission: comm,
        net_earnings: net,
      });
    }

    // 2. Week Chart (Last 4 Weeks)
    const weekChart = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const label = `W-${w === 0 ? "Current" : w + " Ago"} (${weekStart.getDate()} ${weekStart.toLocaleDateString("en-US", { month: "short" })})`;

      const wOrders = allYearOrders.filter((o) => o.created_at >= weekStart && o.created_at <= weekEnd);
      const rev = wOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const itemsCount = wOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
      const comm = Math.round(rev * (commissionRate / 100) * 100) / 100;
      const net = Math.max(0, Math.round((rev - comm) * 100) / 100);

      weekChart.push({
        date: weekStart.toISOString().split("T")[0],
        label,
        revenue: Math.round(rev * 100) / 100,
        orders: wOrders.length,
        items_sold: itemsCount,
        commission: comm,
        net_earnings: net,
      });
    }

    // 3. Month Chart (Last 30 Days)
    const monthChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });

      const dayOrders = allYearOrders.filter((o) => o.created_at.toISOString().split("T")[0] === dayStr);
      const rev = dayOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const itemsCount = dayOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
      const comm = Math.round(rev * (commissionRate / 100) * 100) / 100;
      const net = Math.max(0, Math.round((rev - comm) * 100) / 100);

      monthChart.push({
        date: dayStr,
        label,
        revenue: Math.round(rev * 100) / 100,
        orders: dayOrders.length,
        items_sold: itemsCount,
        commission: comm,
        net_earnings: net,
      });
    }

    // 4. Year Chart (12 Months)
    const yearChart = [];
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(now.getFullYear(), m, 1, 0, 0, 0, 0);
      const mEnd = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59, 999);
      const label = mStart.toLocaleDateString("en-US", { month: "short" });

      const mOrders = allYearOrders.filter((o) => o.created_at >= mStart && o.created_at <= mEnd);
      const rev = mOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const itemsCount = mOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
      const comm = Math.round(rev * (commissionRate / 100) * 100) / 100;
      const net = Math.max(0, Math.round((rev - comm) * 100) / 100);

      yearChart.push({
        date: mStart.toISOString().split("T")[0],
        label,
        revenue: Math.round(rev * 100) / 100,
        orders: mOrders.length,
        items_sold: itemsCount,
        commission: comm,
        net_earnings: net,
      });
    }

    const timeframes = {
      today: {
        revenue: todayRev,
        orders: todayOrders,
        items_sold: todayItemsSold,
        commission_rate: commissionRate,
        commission_amount: todayComm.commission,
        net_earnings: todayComm.net_earnings,
        new_customers: Math.min(newCustomers, todayOrders),
        returning_customers: Math.max(0, todayOrders - Math.min(newCustomers, todayOrders)),
        store_views: todayStoreViews,
      },
      week: {
        revenue: weeklyRev,
        orders: weeklyOrders,
        items_sold: weeklyItemsSold,
        commission_rate: commissionRate,
        commission_amount: weeklyComm.commission,
        net_earnings: weeklyComm.net_earnings,
        new_customers: Math.min(newCustomers, weeklyOrders),
        returning_customers: Math.max(0, weeklyOrders - Math.min(newCustomers, weeklyOrders)),
        store_views: weeklyStoreViews,
      },
      month: {
        revenue: monthlyRev,
        orders: monthlyOrders,
        items_sold: monthlyItemsSold,
        commission_rate: commissionRate,
        commission_amount: monthlyComm.commission,
        net_earnings: monthlyComm.net_earnings,
        new_customers: Math.min(newCustomers, monthlyOrders),
        returning_customers: Math.max(0, monthlyOrders - Math.min(newCustomers, monthlyOrders)),
        store_views: monthlyStoreViews,
      },
      year: {
        revenue: yearlyRev,
        orders: yearlyOrders,
        items_sold: yearlyItemsSold,
        commission_rate: commissionRate,
        commission_amount: yearlyComm.commission,
        net_earnings: yearlyComm.net_earnings,
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        store_views: yearlyStoreViews,
      },
      all_time: {
        revenue: totalRev,
        orders: totalOrders,
        items_sold: totalItemsSold,
        commission_rate: commissionRate,
        commission_amount: totalComm.commission,
        net_earnings: totalComm.net_earnings,
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        store_views: totalStoreViews,
      },
    };

    return {
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        rating: vendor.rating,
        review_count: vendor.review_count,
        is_open: vendor.is_open,
        commission_rate: commissionRate,
      },
      stats: {
        today_orders: todayOrders,
        total_orders: totalOrders,
        today_revenue: todayRev,
        total_revenue: totalRev,
        weekly_revenue: weeklyRev,
        monthly_revenue: monthlyRev,
        yearly_revenue: yearlyRev,
        today_items_sold: todayItemsSold,
        total_items_sold: totalItemsSold,
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        total_customers: totalCustomers,
        store_views: totalStoreViews,
        commission_rate: commissionRate,
        total_commission: totalComm.commission,
        net_earnings: totalComm.net_earnings,
        pending_orders: pendingOrders,
        active_orders: activeOrders,
        total_products: totalProducts,
        low_stock_products: lowStockProducts,
        daily_order_count: todayOrderCounter?.count || 0,
      },
      timeframes,
      charts: {
        day: dayChart,
        week: weekChart,
        month: monthChart,
        year: yearChart,
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
      membership,
    };
  },

  async getVendorAnalytics(userId: string) {
    const dashboard = await this.getMyDashboard(userId);
    return {
      overview: {
        new_customers: dashboard.stats.new_customers,
        repeat_customers: dashboard.stats.returning_customers,
        store_views: dashboard.stats.store_views,
        total_revenue: dashboard.stats.total_revenue,
        total_orders: dashboard.stats.total_orders,
        total_items_sold: dashboard.stats.total_items_sold,
        commission_rate: dashboard.stats.commission_rate,
        total_commission: dashboard.stats.total_commission,
        net_earnings: dashboard.stats.net_earnings,
      },
      timeframes: dashboard.timeframes,
      charts: dashboard.charts,
      top_selling_products: dashboard.top_products.map((tp) => ({
        product_id: tp.product_id,
        name: tp.name,
        views: tp.order_count * 3 + 5,
        sales: tp.total_quantity,
        revenue: Number(tp.price ?? 0) * tp.total_quantity,
      })),
      dailyData: dashboard.charts.month,
    };
  },

  async bulkUploadProducts(userId: string, fileBuffer: Buffer) {
    const vendor = await this.getMyVendor(userId);

    let records: Array<Record<string, string>>;
    try {
      records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (err) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Could not parse CSV: ${(err as Error).message}`, {
        code: "INVALID_CSV",
      });
    }
    if (records.length === 0) {
      return { count: 0 };
    }

    interface BulkRow {
      name: string;
      price: number;
      mrp: number;
      unit: string;
      category_id: string;
      stock: number;
    }

    // ── Validate every row before persisting anything ──
    const validRows: BulkRow[] = [];
    const errors: string[] = [];
    const categoryCache = new Map<string, boolean>();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record) continue; // noUncheckedIndexedAccess guard
      const line = i + 2; // 1-based, skipping the header row
      const name = String(record.name ?? "").trim();
      const priceRaw = String(record.price ?? "").trim();
      const mrpRaw = String(record.mrp ?? "").trim();
      const categoryRaw = String(record.category_id ?? "").trim();
      const unit = String(record.unit ?? "").trim() || "kg";
      const stockRaw = String(record.stock ?? "").trim();

      // Skip fully-empty rows (trailing blank lines produced by editors).
      if (!name && !priceRaw && !mrpRaw && !categoryRaw && !stockRaw && !unit) continue;

      if (!name) {
        errors.push(`Row ${line}: "name" is required.`);
        continue;
      }
      if (name.length > 160) {
        errors.push(`Row ${line}: "name" must be 160 characters or fewer.`);
        continue;
      }

      const price = Number(priceRaw);
      if (!priceRaw || !Number.isFinite(price) || price < 0) {
        errors.push(`Row ${line}: "price" must be a valid non-negative number.`);
        continue;
      }

      let mrp = price;
      if (mrpRaw) {
        mrp = Number(mrpRaw);
        if (!Number.isFinite(mrp) || mrp < 0) {
          errors.push(`Row ${line}: "mrp" must be a valid non-negative number.`);
          continue;
        }
      }

      let stock = 0;
      if (stockRaw) {
        stock = Number(stockRaw);
        if (!Number.isInteger(stock) || stock < 0) {
          errors.push(`Row ${line}: "stock" must be a non-negative integer.`);
          continue;
        }
      }

      if (!categoryRaw) {
        errors.push(`Row ${line}: "category_id" is required.`);
        continue;
      }
      if (!categoryCache.has(categoryRaw)) {
        categoryCache.set(categoryRaw, await categoryExists(categoryRaw));
      }
      if (!categoryCache.get(categoryRaw)) {
        errors.push(`Row ${line}: category_id "${categoryRaw}" does not exist.`);
        continue;
      }

      validRows.push({ name, price, mrp, unit, category_id: categoryRaw, stock });
    }

    if (errors.length > 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Bulk upload failed for ${errors.length} row(s). No products were imported.`,
        { code: "INVALID_ROWS", details: { errors: errors.join("\n") } }
      );
    }

    // ── Deterministic slug generation, deduped against existing products ──
    const existingSlugs = await productRepo.listSlugs(vendor.id);
    const taken = new Set(existingSlugs);
    const rowsWithSlugs = validRows.map((row) => {
      const slug = uniqueSlug(row.name, taken);
      taken.add(slug);
      return { ...row, slug };
    });

    // ── All-or-nothing persistence: a failure rolls back every product ──
    const created = await prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];
      for (const row of rowsWithSlugs) {
        const product = await tx.product.create({
          data: {
            vendor_id: vendor.id,
            category_id: row.category_id,
            name: row.name,
            slug: row.slug,
            price: row.price,
            mrp: row.mrp,
            unit: row.unit,
            stock: row.stock,
            total_stock: row.stock,
            is_available: row.stock > 0,
          },
          select: { id: true },
        });
        createdIds.push(product.id);
      }
      return createdIds;
    });

    await cacheService.invalidateNamespace("product");
    return { count: created.length };
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

  async getVendorEarnings(userId: string, monthFilter?: string) {
    const vendor = await this.getMyVendor(userId);
    const stats = await vendorRepo.getVendorStats(vendor.id, monthFilter);
    const revenue = stats.total_revenue.toNumber();
    const [recent, transactions] = await Promise.all([
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
      listVendorEarningsRecent(vendor.id),
    ]);
    return {
      today_earnings: Math.round(stats.today_earnings.toNumber() * 100) / 100,
      weekly_earnings: Math.round(stats.weekly_earnings.toNumber() * 100) / 100,
      monthly_earnings: Math.round(stats.monthly_earnings.toNumber() * 100) / 100,
      today_revenue: Math.round(stats.today_revenue.toNumber() * 100) / 100,
      weekly_revenue: Math.round(stats.weekly_revenue.toNumber() * 100) / 100,
      monthly_revenue: Math.round(stats.monthly_revenue.toNumber() * 100) / 100,
      total_orders: stats.total_orders,
      active_orders: stats.active_orders,
      total_revenue: Math.round(revenue * 100) / 100,
      total_commission: Math.round(Math.max(0, stats.item_revenue.toNumber() - stats.gross_earnings.toNumber()) * 100) / 100,
      total_refunds: Math.round(stats.refunded_earnings.toNumber() * 100) / 100,
      total_payout: Math.round(stats.total_earnings.toNumber() * 100) / 100,
      pending_payout: Math.round(stats.pending_earnings.toNumber() * 100) / 100,
      product_count: stats.product_count,
      out_of_stock_count: stats.out_of_stock_count,
      transactions,
      recent_transactions: recent.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status.toLowerCase(),
        total: o.total.toNumber(),
        created_at: o.created_at,
      })),
      bank_details: {
        configured: Boolean(vendor.bank_account_number && vendor.bank_ifsc),
        bank_account_number: vendor.bank_account_number ? `••••${vendor.bank_account_number.slice(-4)}` : null,
        bank_ifsc: vendor.bank_ifsc,
        bank_account_holder_name: vendor.bank_account_holder_name,
        bank_name: vendor.bank_name,
        upi_id: vendor.upi_id,
        razorpay_account_id: vendor.razorpay_account_id,
        payout_enabled: vendor.payout_enabled,
      },
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
