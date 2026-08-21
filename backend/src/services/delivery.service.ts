import * as roleRepo from "../repositories/role.repository";
import * as userRepo from "../repositories/user.repository";
import * as orderRepo from "../repositories/order.repository";
import { realtime } from "../realtime/realtime";
import { notificationService } from "./notification.service";
import { ROLES } from "../constants/roles";
import { ConflictError, ForbiddenError } from "../utils/ApiError";
import type {
  DeliveryRegisterBody,
  DeliveryApplyBody,
  DeliveryOrderStatusBody,
  DeliveryLocationBody,
  DeliveredOtpBody,
  DeliveryKycBody,
} from "../validators/integration.validators";

async function upgradeRole(userId: string, slug: string): Promise<void> {
  const role = await roleRepo.findBySlug(slug);
  if (!role) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Role not found.", {
      code: "ROLE_NOT_FOUND",
    });
  }
  await userRepo.changeRole(userId, role.id);
}

async function getKyc(userId: string, type: string) {
  return prisma.kycRecord.findUnique({
    where: { user_id_type: { user_id: userId, type } },
  });
}

// If a soft-deleted profile already exists for this user (deleted account re-registered),
// restore it instead of failing on the unique user_id. Otherwise create a fresh one.
async function restoreOrCreateProfile(
  userId: string,
  input: {
    vehicle_type: string;
    vehicle_number?: string;
    license_number?: string;
  },
) {
  const previous = await prisma.deliveryProfile.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
  });
  if (previous && previous.deleted_at) {
    return prisma.deliveryProfile.update({
      where: { id: previous.id },
      data: {
        deleted_at: null,
        vehicle_type: input.vehicle_type,
        vehicle_number:
          input.vehicle_number && input.vehicle_number.trim()
            ? input.vehicle_number
            : "NA",
        license_number: input.license_number ?? "",
        status: "PENDING",
        is_verified: false,
        is_available: false,
        availability_status: "OFFLINE",
      },
    });
  }
  return prisma.deliveryProfile.create({
    data: {
      user_id: userId,
      vehicle_type: input.vehicle_type,
      vehicle_number:
        input.vehicle_number && input.vehicle_number.trim()
          ? input.vehicle_number
          : "NA",
      license_number: input.license_number ?? "",
      status: "PENDING",
      is_verified: false,
      is_available: false,
      availability_status: "OFFLINE",
    },
  });
}

import type { Request } from "express";
import { Prisma } from "@prisma/client";
import * as addressRepo from "../repositories/address.repository";
import * as vendorRepo from "../repositories/vendor.repository";

const ORDER_STATUS_MAP: Record<string, string> = {
  accepted: "CONFIRMED",
  preparing: "PREPARING",
  packed: "PACKED",
  ready_for_pickup: "READY_FOR_PICKUP",
  picked_up: "PICKED_UP",
  out_for_delivery: "OUT_FOR_DELIVERY",
  // "delivered" is intentionally NOT mapped here. Marking an order DELIVERED
  // requires OTP verification through the dedicated delivered endpoint.
};

// States from which a delivery partner may claim an order.
// Vendor MUST have accepted the order first (CONFIRMED, PREPARING, PACKED, READY_FOR_PICKUP).
// PENDING is strictly excluded because the vendor has not accepted the order yet.
export const ACCEPTABLE_DELIVERY_ASSIGNMENT_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "READY_FOR_PICKUP",
] as const;

export const ACCEPTABLE_DELIVERY_ASSIGNMENT_FILTER: Prisma.OrderWhereInput["status"] =
  {
    in: [...ACCEPTABLE_DELIVERY_ASSIGNMENT_STATUSES],
  };

// States surfaced in the unassigned requests queue and therefore "explicitly
// available" to any approved partner. Surfaced once vendor accepts the order (CONFIRMED).
export const AVAILABLE_DELIVERY_REQUEST_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "READY_FOR_PICKUP",
] as const;

export const AVAILABLE_DELIVERY_REQUEST_FILTER: Prisma.OrderWhereInput["status"] = {
  in: [...AVAILABLE_DELIVERY_REQUEST_STATUSES],
};

/**
 * Returns true if the order is designated for a VegaMart Delivery Partner.
 * Returns false for Self Pickup / Takeaway / Booking, Shop Direct Delivery, or Vendor Comes to Me.
 */
export function isVegaMartDeliveryPartnerOrder(deliveryNote?: string | null): boolean {
  if (!deliveryNote) return true;
  const raw = deliveryNote.trim().toLowerCase();
  if (
    raw.includes("self") ||
    raw.includes("pickup") ||
    raw.includes("takeaway") ||
    raw.includes("booking") ||
    raw.includes("shop") ||
    raw.includes("vendor comes") ||
    raw.includes("comes to me") ||
    raw.includes("street cart")
  ) {
    return false;
  }
  return true;
}

// Cash-on-delivery orders are collected at the door; every other payment method
// must be settled before a delivery partner can be assigned.
function requiresUpfrontPayment(paymentMethod: string): boolean {
  return paymentMethod !== "COD";
}

// The Razorpay payment entity stored in `payments.gateway_response` carries the
// real instrument the customer used (upi / card / netbanking / emi / wallet),
// which is more specific than the order-level `payment_method` (RAZORPAY/COD).
function extractGatewayMethod(
  payment: { gateway_response?: unknown } | null | undefined,
): string | null {
  if (!payment?.gateway_response) return null;
  const gw = payment.gateway_response as { method?: string } | null;
  return gw?.method ?? null;
}

// Forward-only state machine for the delivery-partner status endpoint.
// DELIVERED is never a target here (OTP-gated endpoint only), and backwards
// transitions are rejected. OUT_FOR_DELIVERY is only reachable after PICKED_UP,
// so a partner cannot skip the pickup step before completing a delivery.
const DELIVERY_TRANSITIONS: Record<string, Set<string>> = {
  PENDING: new Set(["CONFIRMED"]),
  CONFIRMED: new Set([
    "CONFIRMED",
    "PREPARING",
    "PACKED",
    "READY_FOR_PICKUP",
    "PICKED_UP",
  ]),
  PREPARING: new Set(["PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP"]),
  PACKED: new Set(["PACKED", "READY_FOR_PICKUP", "PICKED_UP"]),
  READY_FOR_PICKUP: new Set(["READY_FOR_PICKUP", "PICKED_UP"]),
  PICKED_UP: new Set(["PICKED_UP", "OUT_FOR_DELIVERY"]),
  OUT_FOR_DELIVERY: new Set(["OUT_FOR_DELIVERY"]),
  DELIVERED: new Set([]),
  CANCELLED: new Set([]),
  REFUNDED: new Set([]),
  RETURNED: new Set([]),
  FAILED: new Set([]),
};

function assertDeliveryTransition(current: string, next: string): void {
  const allowed = DELIVERY_TRANSITIONS[current];
  if (!allowed || !allowed.has(next)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Cannot transition order from ${current} to ${next}.`,
      { code: "INVALID_STATUS" },
    );
  }
}

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as deliveryRepo from "../repositories/delivery.repository";
import { cacheService } from "../database/cache";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import {
  completeDelivery,
  DELIVERY_PARTNER_DELIVERY_STATES,
  verifyDeliveryOtp,
} from "./order-delivery.service";
import { assertOrderTransition } from "./order-lifecycle.service";

interface TrackingRequester {
  id: string;
  role: string;
}

type TrackingViewer =
  | { kind: "customer"; canSeeDriverInfo: false }
  | { kind: "delivery"; canSeeDriverInfo: boolean }
  | { kind: "vendor"; canSeeDriverInfo: true }
  | { kind: "admin"; canSeeDriverInfo: true };

/**
 * Resolves what tracking data a requester may see for an order.
 *
 * - Customers may only track their own orders (never another customer's).
 * - Delivery partners may track orders assigned to them, plus orders that are
 *   still unassigned in the requests queue (explicitly available to them).
 * - Vendors may track orders for their own store; admins may track anything.
 * - Driver PII (name/phone/vehicle) is only granted to the assigned partner,
 *   the order's vendor, and admins - never to customers or random users.
 */
async function resolveTrackingAccess(
  user: TrackingRequester,
  order: import("../repositories/order.repository").OrderDetail,
): Promise<TrackingViewer> {
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    return { kind: "admin", canSeeDriverInfo: true };
  }

  if (user.role === ROLES.CUSTOMER) {
    if (order.user_id !== user.id) {
      throw new ForbiddenError("You can only track your own orders.");
    }
    return { kind: "customer", canSeeDriverInfo: false };
  }

  if (user.role === ROLES.DELIVERY_PARTNER) {
    const partner = await deliveryRepo.findByUserId(user.id);
    if (!partner) {
      throw new ForbiddenError("Delivery partner profile not found.");
    }
    if (order.delivery_partner_id === partner.id) {
      return { kind: "delivery", canSeeDriverInfo: true };
    }
    if (
      order.delivery_partner_id === null &&
      (AVAILABLE_DELIVERY_REQUEST_STATUSES as readonly string[]).includes(
        order.status,
      )
    ) {
      return { kind: "delivery", canSeeDriverInfo: false };
    }
    throw new ForbiddenError("You can only track orders assigned to you.");
  }

  if (user.role === ROLES.VENDOR) {
    const vendor = await vendorRepo.findByUserId(user.id);
    if (!vendor || vendor.id !== order.vendor_id) {
      throw new ForbiddenError("You can only track orders for your own store.");
    }
    return { kind: "vendor", canSeeDriverInfo: true };
  }

  throw new ForbiddenError(
    "You are not allowed to view this order's tracking.",
  );
}

export const deliveryService = {
  async getMyStats(userId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalDeliveries,
      todayDeliveries,
      activeDeliveries,
      totalEarningsAgg,
      todayEarningsAgg,
      weeklyEarningsAgg,
      monthlyEarningsAgg,
      pendingEarningsAgg,
      recentDeliveries,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          delivery_partner_id: partner.id,
          status: "DELIVERED",
          deleted_at: null,
        },
      }),
      prisma.order.count({
        where: {
          delivery_partner_id: partner.id,
          status: "DELIVERED",
          updated_at: { gte: startOfDay },
          deleted_at: null,
        },
      }),
      prisma.order.count({
        where: {
          delivery_partner_id: partner.id,
          status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
          deleted_at: null,
        },
      }),
      prisma.deliveryEarning.aggregate({
        where: { delivery_partner_id: partner.id },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: {
          delivery_partner_id: partner.id,
          created_at: { gte: startOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: {
          delivery_partner_id: partner.id,
          created_at: { gte: startOfWeek },
        },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: {
          delivery_partner_id: partner.id,
          created_at: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: { delivery_partner_id: partner.id, status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        where: { delivery_partner_id: partner.id, deleted_at: null },
        orderBy: { updated_at: "desc" },
        take: 10,
        select: {
          id: true,
          order_number: true,
          status: true,
          total: true,
          delivery_fee: true,
          updated_at: true,
          vendor: { select: { business_name: true } },
        },
      }),
    ]);

    return {
      partner: {
        id: partner.id,
        rating: partner.rating,
        review_count: partner.review_count,
        is_available: partner.is_available,
        availability_status: partner.availability_status,
      },
      stats: {
        total_deliveries: totalDeliveries,
        today_deliveries: todayDeliveries,
        active_deliveries: activeDeliveries,
        total_earnings: Number(totalEarningsAgg._sum?.amount ?? 0),
        today_earnings: Number(todayEarningsAgg._sum?.amount ?? 0),
        weekly_earnings: Number(weeklyEarningsAgg._sum?.amount ?? 0),
        monthly_earnings: Number(monthlyEarningsAgg._sum?.amount ?? 0),
        pending_earnings: Number(pendingEarningsAgg._sum?.amount ?? 0),
      },
      recent_deliveries: recentDeliveries.map((d) => ({
        id: d.id,
        order_number: d.order_number,
        status: d.status.toLowerCase(),
        total: Number(d.total),
        delivery_fee: Number(d.delivery_fee),
        vendor_name: d.vendor?.business_name ?? "Vendor",
        updated_at: d.updated_at,
      })),
    };
  },

  async getMyEarnings(
    userId: string,
    query: { period?: string; page?: number; per_page?: number },
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));

    let dateFilter: Date | undefined;
    const now = new Date();
    if (query.period === "today") {
      dateFilter = new Date(now);
      dateFilter.setHours(0, 0, 0, 0);
    } else if (query.period === "week") {
      dateFilter = new Date(now);
      dateFilter.setDate(now.getDate() - 7);
    } else if (query.period === "month") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const where: Prisma.DeliveryEarningWhereInput = {
      delivery_partner_id: partner.id,
    };
    if (dateFilter) {
      where.created_at = { gte: dateFilter };
    }

    const [earnings, total, totalAgg] = await Promise.all([
      prisma.deliveryEarning.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          amount: true,
          status: true,
          type: true,
          created_at: true,
          order: {
            select: {
              id: true,
              order_number: true,
              total: true,
              vendor: { select: { business_name: true } },
            },
          },
        },
      }),
      prisma.deliveryEarning.count({ where }),
      prisma.deliveryEarning.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      earnings: earnings.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        status: e.status.toLowerCase(),
        type: e.type.toLowerCase(),
        order_number: e.order?.order_number ?? null,
        order_total: e.order ? Number(e.order.total) : null,
        vendor_name: e.order?.vendor?.business_name ?? null,
        created_at: e.created_at,
      })),
      summary: {
        total_earnings: Number(totalAgg._sum?.amount ?? 0),
        period: query.period ?? "all",
      },
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  },

  async setAvailability(userId: string, isAvailable: boolean, req: Request) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    if (partner.status !== "APPROVED") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Delivery partner must be approved.",
        {
          code: "DELIVERY_NOT_APPROVED",
        },
      );
    }

    const availabilityStatus = isAvailable ? "ONLINE" : "OFFLINE";
    const updated = await deliveryRepo.updateDelivery(partner.id, {
      is_available: isAvailable,
      availability_status: availabilityStatus,
    });

    await cacheService.invalidateNamespace("delivery");
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: {
          is_available: isAvailable,
          availability_status: availabilityStatus,
        },
      },
      req,
    );

    return {
      id: updated.id,
      is_available: updated.is_available,
      availability_status: updated.availability_status,
    };
  },

  async updateProfile(
    userId: string,
    input: Record<string, unknown>,
    req: Request,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const allowed = [
      "vehicle_type",
      "vehicle_number",
      "license_number",
      "base_delivery_fee",
      "fee_per_km",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in input && input[key] !== undefined) {
        data[key] = input[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return partner;
    }

    const updated = await deliveryRepo.updateDelivery(
      partner.id,
      data as never,
    );
    await cacheService.invalidateNamespace("delivery");
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: data,
      },
      req,
    );

    return updated;
  },
  // ---------------------------------------------------------------------------
  // Delivery partner module
  // ---------------------------------------------------------------------------
  async registerDelivery(
    userId: string,
    input: DeliveryRegisterBody,
    req: Request,
  ) {
    const existing = await deliveryRepo.findByUserId(userId);
    if (existing) {
      return existing;
    }
    const user = await userRepo.findById(userId, { role: true });
    if (user?.role.slug !== ROLES.DELIVERY_PARTNER) {
      await upgradeRole(userId, ROLES.DELIVERY_PARTNER);
    }
    const partner = await restoreOrCreateProfile(userId, input);
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: { vehicle_type: input.vehicle_type },
      },
      req,
    );
    return partner;
  },

  async applyDelivery(userId: string, input: DeliveryApplyBody, req: Request) {
    const existing = await deliveryRepo.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const userUpdates: Record<string, string> = {};
    if (
      typeof input.full_name === "string" &&
      input.full_name.trim().length > 0
    ) {
      userUpdates.name = input.full_name.trim();
    }
    if (typeof input.phone === "string" && input.phone.trim().length > 0) {
      userUpdates.phone = input.phone.trim();
    }
    if (Object.keys(userUpdates).length > 0) {
      await userRepo.update(userId, userUpdates as never);
    }

    const user = await userRepo.findById(userId, { role: true });
    if (user?.role.slug !== ROLES.DELIVERY_PARTNER) {
      await upgradeRole(userId, ROLES.DELIVERY_PARTNER);
    }

    const partner = await restoreOrCreateProfile(userId, input);
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: { vehicle_type: input.vehicle_type },
      },
      req,
    );
    return partner;
  },

  async getDeliveryMe(userId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const [detail, kyc] = await Promise.all([
      deliveryRepo.getDetail(partner.id),
      getKyc(userId, "delivery"),
    ]);
    const user = await userRepo.findById(userId, {});
    return {
      id: partner.id,
      user_id: partner.user_id,
      full_name: user?.name ?? "",
      phone: user?.phone ?? null,
      avatar_url: user?.avatar_url ?? null,
      vehicle_type: partner.vehicle_type,
      vehicle_number: partner.vehicle_number,
      license_number: partner.license_number,
      base_delivery_fee: Number(partner.base_delivery_fee ?? 0),
      fee_per_km: Number(partner.fee_per_km ?? 0),
      status: partner.status.toLowerCase(),
      is_verified: partner.is_verified,
      is_available: partner.is_available,
      availability_status: partner.availability_status.toLowerCase(),
      current_lat: partner.current_lat,
      current_lng: partner.current_lng,
      rating: partner.rating,
      review_count: partner.review_count,
      rejection_reason: partner.rejection_reason,
      kyc: kyc
        ? {
            status: kyc.status.toLowerCase(),
            rejection_reason: kyc.rejection_reason,
            ...(kyc.documents as Record<string, unknown> | null),
          }
        : null,
      stats: detail?.stats ?? null,
      created_at: partner.created_at,
      updated_at: partner.updated_at,
    };
  },

  async listDeliveryRequests() {
    const rows = await prisma.order.findMany({
      where: {
        deleted_at: null,
        delivery_partner_id: null,
        status: AVAILABLE_DELIVERY_REQUEST_FILTER,
        vendor: { is: { status: "APPROVED" } },
        AND: [
          {
            NOT: {
              delivery_note: {
                contains: "self",
                mode: "insensitive",
              },
            },
          },
          {
            NOT: {
              delivery_note: {
                contains: "pickup",
                mode: "insensitive",
              },
            },
          },
          {
            NOT: {
              delivery_note: {
                contains: "takeaway",
                mode: "insensitive",
              },
            },
          },
          {
            NOT: {
              delivery_note: {
                contains: "booking",
                mode: "insensitive",
              },
            },
          },
          {
            NOT: {
              delivery_note: {
                contains: "shop",
                mode: "insensitive",
              },
            },
          },
          {
            NOT: {
              delivery_note: {
                contains: "comes",
                mode: "insensitive",
              },
            },
          },
        ],
      },
      orderBy: { created_at: "asc" },
      take: 50,
      select: {
        id: true,
        order_number: true,
        status: true,
        delivery_fee: true,
        items_subtotal: true,
        tax: true,
        discount: true,
        total: true,
        delivery_note: true,
        payment_method: true,
        payment_status: true,
        created_at: true,
        payment: { select: { amount: true, method: true, status: true, gateway_response: true } },
        items: {
          select: {
            id: true,
            product_name: true,
            quantity: true,
            unit: true,
            selected_unit: true,
            unit_price: true,
            total_price: true,
            image_url: true,
            status: true,
          },
        },
        vendor: {
          select: {
            id: true,
            business_name: true,
            address: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            owner_name: true,
            latitude: true,
            longitude: true,
          },
        },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        address: {
          select: {
            id: true,
            label: true,
            full_address: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    const filtered = rows.filter((r) => isVegaMartDeliveryPartnerOrder(r.delivery_note));

    return filtered.map((r) => {
      const isPaid = r.payment_status === "PAID";
      const advAmount = r.payment?.amount ? r.payment.amount.toNumber() : (isPaid && r.payment_method !== "COD" ? r.total.toNumber() : 0);
      const balanceAmount = r.payment_method === "COD"
        ? r.total.toNumber()
        : (isPaid && r.payment?.amount
            ? Math.max(0, Math.round((r.total.toNumber() - r.payment.amount.toNumber()) * 100) / 100)
            : (isPaid ? 0 : r.total.toNumber()));

      return {
        id: r.id,
        order_number: r.order_number,
        status: r.status,
        delivery_fee: r.delivery_fee.toNumber(),
        subtotal: r.items_subtotal ? r.items_subtotal.toNumber() : 0,
        tax: r.tax ? r.tax.toNumber() : 0,
        discount: r.discount ? r.discount.toNumber() : 0,
        total_amount: r.total.toNumber(),
        advance_paid: advAmount,
        balance_amount: balanceAmount,
        payment: r.payment
          ? {
              amount: r.payment.amount ? r.payment.amount.toNumber() : null,
              method: r.payment.method,
              status: r.payment.status,
            }
          : null,
        delivery_option: r.delivery_note ?? "Delivery partner",
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        gateway_method: extractGatewayMethod(r.payment),
        items: (r.items || []).map((i) => ({
          id: i.id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          selected_unit: i.selected_unit || i.unit,
          unit_price: i.unit_price ? i.unit_price.toNumber() : 0,
          total_price: i.total_price ? i.total_price.toNumber() : 0,
          image_url: i.image_url,
          status: i.status,
        })),
        product_image: (r.items || [])[0]?.image_url ?? null,
        created_at: r.created_at,
        vendor: r.vendor
          ? {
              ...r.vendor,
              lat: r.vendor.latitude,
              lng: r.vendor.longitude,
            }
          : null,
        user: r.customer ?? null,
        address: r.address
          ? {
              ...r.address,
              street_address: r.address.full_address || [r.address.landmark, r.address.city, r.address.pincode].filter(Boolean).join(", "),
              lat: r.address.latitude,
              lng: r.address.longitude,
            }
          : null,
      };
    });
  },

  async listMyDeliveries(userId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const rows = await prisma.order.findMany({
      where: { delivery_partner_id: partner.id, deleted_at: null },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        order_number: true,
        status: true,
        items_subtotal: true,
        tax: true,
        discount: true,
        total: true,
        delivery_fee: true,
        delivery_note: true,
        payment_method: true,
        payment_status: true,
        otp_code: true,
        created_at: true,
        payment: { select: { amount: true, method: true, status: true, gateway_response: true } },
        items: {
          select: {
            id: true,
            product_name: true,
            quantity: true,
            unit: true,
            selected_unit: true,
            unit_price: true,
            total_price: true,
            image_url: true,
            status: true,
          },
        },
        vendor: {
          select: {
            id: true,
            business_name: true,
            address: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            owner_name: true,
            latitude: true,
            longitude: true,
          },
        },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        address: {
          select: {
            id: true,
            label: true,
            full_address: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    return rows.map((r) => {
      const isPaid = r.payment_status === "PAID";
      const advAmount = r.payment?.amount ? r.payment.amount.toNumber() : (isPaid && r.payment_method !== "COD" ? r.total.toNumber() : 0);
      const balanceAmount = r.payment_method === "COD"
        ? r.total.toNumber()
        : (isPaid && r.payment?.amount
            ? Math.max(0, Math.round((r.total.toNumber() - r.payment.amount.toNumber()) * 100) / 100)
            : (isPaid ? 0 : r.total.toNumber()));

      return {
        id: r.id,
        order_number: r.order_number,
        status: r.status.toLowerCase(),
        subtotal: r.items_subtotal ? r.items_subtotal.toNumber() : 0,
        tax: r.tax ? r.tax.toNumber() : 0,
        discount: r.discount ? r.discount.toNumber() : 0,
        total_amount: r.total.toNumber(),
        advance_paid: advAmount,
        balance_amount: balanceAmount,
        payment: r.payment
          ? {
              amount: r.payment.amount ? r.payment.amount.toNumber() : null,
              method: r.payment.method,
              status: r.payment.status,
            }
          : null,
        delivery_fee: r.delivery_fee.toNumber(),
        delivery_option: r.delivery_note ?? "Delivery partner",
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        gateway_method: extractGatewayMethod(r.payment),
        items: r.items.map((i) => ({
          id: i.id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          selected_unit: i.selected_unit || i.unit,
          unit_price: i.unit_price ? i.unit_price.toNumber() : 0,
          total_price: i.total_price ? i.total_price.toNumber() : 0,
          image_url: i.image_url,
          status: i.status,
        })),
        product_image: r.items[0]?.image_url ?? null,
        created_at: r.created_at,
        vendor: r.vendor
          ? {
              ...r.vendor,
              lat: r.vendor.latitude,
              lng: r.vendor.longitude,
            }
          : null,
        user: r.customer ?? null,
        address: r.address
          ? {
              ...r.address,
              street_address: r.address.full_address || [r.address.landmark, r.address.city, r.address.pincode].filter(Boolean).join(", "),
              lat: r.address.latitude,
              lng: r.address.longitude,
            }
          : null,
      };
    });
  },

  async acceptDelivery(
    userId: string,
    orderId: string,
    etaMinutes: number,
    req: Request,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    if (partner.status !== "APPROVED") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Delivery partner must be approved.",
        { code: "DELIVERY_NOT_APPROVED" },
      );
    }
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.delivery_partner_id) {
      throw new ConflictError(
        "This order already has a delivery partner assigned.",
      );
    }
    if (order.status === "PENDING") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Order has not been accepted by the vendor yet. Delivery partner can only accept orders after vendor confirmation.",
        { code: "ORDER_NOT_ACCEPTED_BY_VENDOR" },
      );
    }
    if (!isVegaMartDeliveryPartnerOrder(order.delivery_note)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "This order is not designated for VegaMart Delivery Partner (e.g. Self Pickup or Shop Delivery).",
        { code: "INVALID_DELIVERY_OPTION" },
      );
    }
    if (
      !(ACCEPTABLE_DELIVERY_ASSIGNMENT_STATUSES as readonly string[]).includes(
        order.status,
      )
    ) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        `Order cannot be accepted in its current state (${order.status}).`,
        { code: "ORDER_NOT_ACCEPTABLE" },
      );
    }
    if (
      requiresUpfrontPayment(order.payment_method) &&
      order.payment_status !== "PAID"
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Order payment is not complete.",
        { code: "ORDER_PAYMENT_REQUIRED" },
      );
    }

    // The conditional updateMany is the authoritative guard: a claim only lands
    // when the order is still unassigned, still in an acceptable state, and
    // (for paid orders) still paid. Two partners racing to accept the same
    // order resolve here - exactly one updateMany matches, the other sees
    // count === 0. The pre-query above is only for friendly error messages.
    const claimWhere: Prisma.OrderWhereInput = {
      id: orderId,
      delivery_partner_id: null,
      status: ACCEPTABLE_DELIVERY_ASSIGNMENT_FILTER,
      AND: [
        {
          NOT: {
            delivery_note: {
              contains: "self",
              mode: "insensitive",
            },
          },
        },
        {
          NOT: {
            delivery_note: {
              contains: "pickup",
              mode: "insensitive",
            },
          },
        },
        {
          NOT: {
            delivery_note: {
              contains: "takeaway",
              mode: "insensitive",
            },
          },
        },
        {
          NOT: {
            delivery_note: {
              contains: "booking",
              mode: "insensitive",
            },
          },
        },
        {
          NOT: {
            delivery_note: {
              contains: "shop",
              mode: "insensitive",
            },
          },
        },
        {
          NOT: {
            delivery_note: {
              contains: "comes",
              mode: "insensitive",
            },
          },
        },
      ],
    };
    if (requiresUpfrontPayment(order.payment_method)) {
      claimWhere.payment_status = "PAID";
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: claimWhere,
        data: { delivery_partner_id: partner.id, eta_minutes: etaMinutes },
      });
      if (claimed.count === 0) {
        throw new ConflictError(
          "This order already has a delivery partner assigned.",
        );
      }
      await tx.orderEvent.create({
        data: {
          order_id: orderId,
          status: "CONFIRMED",
          note: `Delivery partner accepted the order. ETA: ${etaMinutes} mins.`,
          actor_type: "delivery",
          actor_id: userId,
        },
      });
      return tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          order_number: true,
          status: true,
          total: true,
          user_id: true,
        },
      });
    });
    if (!updated) {
      throw new NotFoundError("Order not found.");
    }
    await prisma.deliveryTracking.upsert({
      where: { order_id: orderId },
      update: {},
      create: { order_id: orderId, status: "CONFIRMED" },
    });
    await notificationService.orderStatus(
      order.user_id,
      order.order_number,
      "Delivery partner assigned",
      "A delivery partner has accepted your order.",
      { order_id: orderId },
    );
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_ACCEPTED,
        entityType: "order",
        entityId: orderId,
        newValues: { partner_id: partner.id },
      },
      req,
    );
    realtime.publishOrderStatus(orderId, updated.status);
    return updated;
  },

  async updateDeliveryStatus(
    userId: string,
    orderId: string,
    input: DeliveryOrderStatusBody,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.delivery_partner_id !== partner.id) {
      throw new ForbiddenError("This order is not assigned to you.");
    }
    const mapped = ORDER_STATUS_MAP[input.status];
    if (!mapped) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid delivery status.", {
        code: "INVALID_STATUS",
      });
    }
    assertDeliveryTransition(order.status, mapped);
    assertOrderTransition(order.status, mapped);
    const timestamps: Record<string, Date> = {};
    if (mapped === "PICKED_UP") timestamps.picked_up_at = new Date();
    if (mapped === "OUT_FOR_DELIVERY") timestamps.started_at = new Date();

    const updated = await orderRepo.updateOrderStatus(orderId, {
      status: mapped,
      note: `Delivery status updated to ${input.status}.`,
      actorType: "delivery",
      actorId: userId,
      timestamps,
    });

    await prisma.deliveryTracking.upsert({
      where: { order_id: orderId },
      update: { status: mapped as never },
      create: { order_id: orderId, status: mapped as never },
    });

    await notificationService.orderStatus(
      order.user_id,
      order.order_number,
      "Delivery update",
      `Your order is now ${input.status.replace(/_/g, " ")}.`,
      { order_id: orderId },
    );

    realtime.publishOrderStatus(orderId, mapped);
    return updated;
  },

  async updateDeliveryLocation(userId: string, input: DeliveryLocationBody) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const updated = await deliveryRepo.updateDelivery(partner.id, {
      current_lat: input.lat,
      current_lng: input.lng,
    });
    const activeOrders = await prisma.order.findMany({
      where: {
        delivery_partner_id: partner.id,
        status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      },
      select: { id: true },
    });
    for (const order of activeOrders) {
      await prisma.deliveryTracking.upsert({
        where: { order_id: order.id },
        update: { driver_lat: input.lat, driver_lng: input.lng },
        create: {
          order_id: order.id,
          driver_lat: input.lat,
          driver_lng: input.lng,
        },
      });
      realtime.publishOrderLocation(order.id, input.lat, input.lng);
    }
    return updated;
  },

  async markDelivered(
    userId: string,
    orderId: string,
    input: DeliveredOtpBody,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.delivery_partner_id !== partner.id) {
      throw new ForbiddenError("This order is not assigned to you.");
    }

    await verifyDeliveryOtp(order, input.otp, DELIVERY_PARTNER_DELIVERY_STATES);

    const updated = await completeDelivery({
      orderId: order.id,
      partnerId: partner.id,
      otp: input.otp,
      allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
      actorType: "delivery",
      actorId: userId,
    });

    await notificationService.orderStatus(
      order.user_id,
      order.order_number,
      "Order delivered",
      "Your order has been delivered. Enjoy your groceries!",
      { order_id: orderId },
    );
    realtime.publishOrderStatus(orderId, "DELIVERED");
    return updated;
  },

  async submitDeliveryKyc(
    userId: string,
    input: DeliveryKycBody,
    req: Request,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const kyc = await prisma.kycRecord.upsert({
      where: { user_id_type: { user_id: userId, type: "delivery" } },
      update: {
        documents: input as unknown as Prisma.InputJsonValue,
        status: "PENDING",
        rejection_reason: null,
      },
      create: {
        user_id: userId,
        type: "delivery",
        documents: input as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.KYC_SUBMITTED,
        entityType: "kyc",
        entityId: kyc.id,
        newValues: { type: "delivery", status: kyc.status },
      },
      req,
    );
    return kyc;
  },

  async getDeliveryTracking(user: TrackingRequester, orderId: string) {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    const viewer = await resolveTrackingAccess(user, order);
    const [tracking, address, vendor] = await Promise.all([
      prisma.deliveryTracking.findUnique({ where: { order_id: orderId } }),
      addressRepo.findById(order.address_id),
      vendorRepo.findById(order.vendor_id),
    ]);
    let driverInfo = null;
    if (viewer.canSeeDriverInfo && order.delivery_partner_id) {
      const partner = await prisma.deliveryProfile.findUnique({
        where: { id: order.delivery_partner_id },
      });
      if (partner) {
        const driverUser = await userRepo.findById(partner.user_id, {});
        driverInfo = {
          name: driverUser?.name ?? "Delivery Partner",
          phone: driverUser?.phone ?? null,
          rating: partner.rating,
          review_count: partner.review_count,
          vehicle_type: partner.vehicle_type,
          vehicle_number: partner.vehicle_number,
        };
      }
    }
    return {
      order_id: orderId,
      status: tracking?.status ?? order.status,
      driver_location:
        tracking?.driver_lat != null && tracking?.driver_lng != null
          ? { lat: tracking.driver_lat, lng: tracking.driver_lng }
          : null,
      pickup_location:
        tracking?.pickup_lat != null && tracking?.pickup_lng != null
          ? { lat: tracking.pickup_lat, lng: tracking.pickup_lng }
          : vendor?.latitude != null && vendor?.longitude != null
            ? { lat: vendor.latitude, lng: vendor.longitude }
            : null,
      dropoff_location:
        tracking?.dropoff_lat != null && tracking?.dropoff_lng != null
          ? { lat: tracking.dropoff_lat, lng: tracking.dropoff_lng }
          : address?.latitude != null && address?.longitude != null
            ? { lat: address.latitude, lng: address.longitude }
            : null,
      eta:
        tracking?.eta_minutes != null
          ? `${tracking.eta_minutes} min`
          : order.eta_minutes != null
            ? `${order.eta_minutes} min`
            : null,
      driver_info: driverInfo,
      order_status: order.status,
    };
  },

  /**
   * Retrieves full wallet overview, available balance, escrow transit balance, and recent trips ledger for a delivery partner.
   */
  async getDeliveryWalletOverview(deliveryPartnerId: string) {
    const partner = await prisma.deliveryProfile.findUnique({
      where: { id: deliveryPartnerId },
      include: { user: true },
    });

    if (!partner) throw new Error("Delivery partner profile not found");

    // 1. Settled Earnings
    const settledAgg = await prisma.deliveryEarning.aggregate({
      where: { delivery_partner_id: deliveryPartnerId, status: "SETTLED" },
      _sum: { amount: true },
    });

    // 2. Pending Escrow
    const pendingAgg = await prisma.deliveryEarning.aggregate({
      where: { delivery_partner_id: deliveryPartnerId, status: "PENDING" },
      _sum: { amount: true },
    });

    // 3. Completed Withdrawals
    const completedWithdrawalsAgg = await (prisma as any).payoutRequest.aggregate({
      where: { delivery_partner_id: deliveryPartnerId, status: "COMPLETED" },
      _sum: { amount: true },
    });

    // 4. In-flight Withdrawals
    const inFlightWithdrawalsAgg = await (prisma as any).payoutRequest.aggregate({
      where: {
        delivery_partner_id: deliveryPartnerId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    });

    const totalSettledEarnings = Number(settledAgg._sum.amount ?? 0);
    const totalPendingEscrow = Number(pendingAgg._sum.amount ?? 0);
    const totalWithdrawn = Number(completedWithdrawalsAgg._sum.amount ?? 0);
    const inFlightWithdrawing = Number(inFlightWithdrawalsAgg._sum.amount ?? 0);

    const netBalance = Math.round((totalSettledEarnings - totalWithdrawn - inFlightWithdrawing) * 100) / 100;
    const availableBalance = Math.max(0, netBalance);
    const deficitBalance = netBalance < 0 ? Math.abs(netBalance) : 0;

    // Completed Trips Count
    const completedTripsCount = await prisma.deliveryEarning.count({
      where: { delivery_partner_id: deliveryPartnerId },
    });

    // Recent Withdrawals
    const recentWithdrawals = await (prisma as any).payoutRequest.findMany({
      where: { delivery_partner_id: deliveryPartnerId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    // Recent Earnings Ledger
    const recentEarnings = await prisma.deliveryEarning.findMany({
      where: { delivery_partner_id: deliveryPartnerId },
      include: {
        order: {
          select: { order_number: true, total: true, delivery_fee: true, created_at: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 25,
    });

    const partnerData = partner as any;

    return {
      available_balance: availableBalance,
      deficit_balance: deficitBalance,
      net_balance: netBalance,
      pending_escrow: totalPendingEscrow,
      total_withdrawn: totalWithdrawn,
      in_flight_withdrawing: inFlightWithdrawing,
      lifetime_settled: totalSettledEarnings,
      completed_trips_count: completedTripsCount,
      bank_configured: Boolean(partnerData.bank_account_number && partnerData.bank_ifsc),
      bank_details: {
        bank_account_number: partnerData.bank_account_number || null,
        bank_ifsc: partnerData.bank_ifsc || null,
        bank_account_holder_name: partnerData.bank_account_holder_name || null,
        bank_name: partnerData.bank_name || null,
        upi_id: partnerData.upi_id || null,
        payout_enabled: partnerData.payout_enabled !== false,
      },
      recent_withdrawals: recentWithdrawals.map((w: any) => ({
        id: w.id,
        amount: Number(w.amount),
        payout_mode: w.payout_mode,
        account_number: w.account_number,
        ifsc_code: w.ifsc_code,
        upi_id: w.upi_id,
        status: w.status,
        utr_reference: w.utr_reference,
        notes: w.notes,
        created_at: w.created_at,
        processed_at: w.processed_at,
      })),
      wallet_ledger: recentEarnings.map((e) => ({
        id: e.id,
        type: e.type,
        status: e.status,
        amount: Number(e.amount),
        order_number: e.order?.order_number || null,
        order_total: e.order ? Number(e.order.total) : null,
        reference_id: e.reference_id,
        created_at: e.created_at,
      })),
    };
  },

  /**
   * Submits an on-demand withdrawal request for a delivery partner.
   */
  async requestDeliveryWithdrawal(
    deliveryPartnerId: string,
    input: { amount: number; payout_mode?: "BANK_TRANSFER" | "UPI"; notes?: string }
  ) {
    const partner = await prisma.deliveryProfile.findUnique({
      where: { id: deliveryPartnerId },
      include: { user: true },
    });

    if (!partner) throw new Error("Delivery partner profile not found");
    const partnerData = partner as any;
    if (partnerData.payout_enabled === false) {
      throw new Error("Payouts are disabled for this delivery account. Please contact support.");
    }

    const requestedAmount = Math.round(Number(input.amount) * 100) / 100;
    if (isNaN(requestedAmount) || requestedAmount < 50) {
      throw new Error("Minimum withdrawal amount for delivery partners is ₹50.");
    }

    const mode = input.payout_mode || (partnerData.upi_id ? "UPI" : "BANK_TRANSFER");
    if (mode === "BANK_TRANSFER" && (!partnerData.bank_account_number || !partnerData.bank_ifsc)) {
      throw new Error("Please configure your Bank Account Number and IFSC Code before requesting a bank payout.");
    }
    if (mode === "UPI" && !partnerData.upi_id) {
      throw new Error("Please configure your UPI ID before requesting a UPI payout.");
    }

    const overview = await this.getDeliveryWalletOverview(deliveryPartnerId);
    if (requestedAmount > overview.available_balance) {
      throw new Error(`Insufficient available balance. Maximum withdrawable: ₹${overview.available_balance.toFixed(2)}`);
    }

    const request = await (prisma as any).payoutRequest.create({
      data: {
        delivery_partner_id: deliveryPartnerId,
        amount: requestedAmount,
        payout_mode: mode,
        account_number: partnerData.bank_account_number,
        ifsc_code: partnerData.bank_ifsc,
        account_holder: partnerData.bank_account_holder_name || partner.user?.name,
        bank_name: partnerData.bank_name,
        upi_id: partnerData.upi_id,
        status: "PENDING",
        notes: input.notes || null,
      },
    });

    if (partner.user_id) {
      await notificationService.payment(
        partner.user_id,
        "Withdrawal Request Submitted 🏍️💸",
        `Your payout request for ₹${requestedAmount.toFixed(2)} via ${mode === "UPI" ? "UPI" : "Bank Transfer"} has been received. Funds will be transferred to your account shortly.`
      );
    }

    return {
      success: true,
      request_id: request.id,
      amount: requestedAmount,
      status: "PENDING",
      message: `Withdrawal request for ₹${requestedAmount.toFixed(2)} submitted successfully.`,
    };
  },

  /**
   * Updates bank and UPI credentials for a delivery partner.
   */
  async updateDeliveryBankDetails(
    deliveryPartnerId: string,
    input: {
      bank_account_number?: string | null;
      bank_ifsc?: string | null;
      bank_account_holder_name?: string | null;
      bank_name?: string | null;
      upi_id?: string | null;
    }
  ) {
    const updated = await (prisma as any).deliveryProfile.update({
      where: { id: deliveryPartnerId },
      data: {
        bank_account_number: input.bank_account_number ?? undefined,
        bank_ifsc: input.bank_ifsc ? input.bank_ifsc.toUpperCase().trim() : undefined,
        bank_account_holder_name: input.bank_account_holder_name ?? undefined,
        bank_name: input.bank_name ?? undefined,
        upi_id: input.upi_id ? input.upi_id.toLowerCase().trim() : undefined,
      },
    });

    return updated;
  },

  /**
   * Exports rider earnings ledger as CSV.
   */
  async exportDeliveryWalletStatementCsv(deliveryPartnerId: string): Promise<string> {
    const earnings = await prisma.deliveryEarning.findMany({
      where: { delivery_partner_id: deliveryPartnerId },
      include: {
        order: { select: { order_number: true, total: true, delivery_fee: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const headers = ["Date", "Order Number", "Transaction Type", "Delivery Fee (INR)", "Status", "Reference"];
    const rows = earnings.map((e) => [
      `"${new Date(e.created_at).toISOString()}"`,
      `"${e.order?.order_number || ""}"`,
      `"${e.type}"`,
      Number(e.amount).toFixed(2),
      `"${e.status}"`,
      `"${e.reference_id || ""}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },
};
