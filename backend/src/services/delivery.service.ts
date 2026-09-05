import * as roleRepo from "../repositories/role.repository";
import * as userRepo from "../repositories/user.repository";
import { notificationService } from "./notification.service";
import { realtime } from "../realtime/realtime";
import { ROLES } from "../constants/roles";
import { ConflictError, ForbiddenError } from "../utils/ApiError";
import { completeDelivery } from "./order-delivery.service";
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

// States from which a delivery partner may claim an order.
export const ACCEPTABLE_DELIVERY_ASSIGNMENT_STATUSES = [
  "PENDING",
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
// available" to any approved partner.
export const AVAILABLE_DELIVERY_REQUEST_STATUSES = [
  "PENDING",
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

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as deliveryRepo from "../repositories/delivery.repository";
import { cacheService } from "../database/cache";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

interface TrackingRequester {
  id: string;
  role: string;
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

  async notifyVendor(userId: string, masterOrderId: string, subOrderId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) throw new NotFoundError("Delivery partner not found.");
    
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: masterOrderId, delivery_partner_id: partner.id },
      include: { orders: true }
    });
    if (!masterOrder) throw new NotFoundError("Order not found or not assigned to you.");
    
    const subOrder = masterOrder.orders.find((o) => o.id === subOrderId);
    if (!subOrder) throw new NotFoundError("Sub-order not found.");
    
    // Notify vendor
    await notificationService.orderStatus(
      subOrder.vendor_id,
      subOrder.order_number,
      "Delivery Partner Arriving",
      "The delivery partner is arriving soon. Please keep the order ready.",
      { order_id: subOrder.id }
    );
    
    return { success: true };
  },

  async reportIssue(userId: string, masterOrderId: string, subOrderId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) throw new NotFoundError("Delivery partner not found.");
    
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: masterOrderId, delivery_partner_id: partner.id },
      include: { orders: true }
    });
    if (!masterOrder) throw new NotFoundError("Order not found or not assigned to you.");
    
    const subOrder = masterOrder.orders.find((o) => o.id === subOrderId);
    if (!subOrder) throw new NotFoundError("Sub-order not found.");
    
    // Notify Admin about the issue
    await prisma.orderEvent.create({
      data: {
        order: { connect: { id: subOrder.id } },
        status: subOrder.status as never,
        note: `Delivery Partner reported an issue (Vendor Unreachable / Closed).`,
        actor_type: "delivery_partner",
        actor_id: userId,
      },
    });

    // Notify admins (could be expanded to a dedicated admin notification channel)
    // For now, logging an event is sufficient for the admin panel to pick it up.

    return { success: true };
  },

  async confirmPickup(userId: string, masterOrderId: string, subOrderId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) throw new NotFoundError("Delivery partner not found.");
    
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: masterOrderId, delivery_partner_id: partner.id },
      include: { orders: true }
    });
    if (!masterOrder) throw new NotFoundError("Order not found or not assigned to you.");
    
    const subOrder = masterOrder.orders.find((o) => o.id === subOrderId);
    if (!subOrder) throw new NotFoundError("Sub-order not found.");
    
    if (subOrder.status !== "READY_FOR_PICKUP" && subOrder.status !== "PREPARING") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Cannot confirm pickup. Vendor status is ${subOrder.status}.`,
        { code: "INVALID_STATUS" }
      );
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: subOrderId },
        data: { status: "PICKED_UP" },
      });
      await tx.orderEvent.create({
        data: {
          order_id: subOrderId,
          status: "PICKED_UP",
          note: "Delivery partner confirmed pickup.",
          actor_type: "delivery",
          actor_id: userId,
        },
      });
    });

    // Fetch vendor name for a better customer notification
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: subOrder.vendor_id },
      select: { business_name: true },
    });
    const storeName = vendor?.business_name ?? "a store";
    const totalStores = masterOrder.orders.length;
    const pickedUpCount = masterOrder.orders.filter(
      (o) => o.status === "PICKED_UP" || o.id === subOrderId
    ).length;

    // Notify customer about the pickup progress
    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      "Order picked up",
      `Your items from ${storeName} have been picked up (${pickedUpCount}/${totalStores} stores done).`,
      { order_id: masterOrderId, sub_order_id: subOrderId },
    );

    // Push real-time update to customer's tracking page
    realtime.publishOrderStatus(masterOrderId, "PICKED_UP");

    return { success: true };
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
    const rows = await prisma.masterOrder.findMany({
      where: {
        delivery_partner_id: null,
        orders: {
          some: {
            status: AVAILABLE_DELIVERY_REQUEST_FILTER,
            vendor: { is: { status: "APPROVED" } },
            OR: [
              { delivery_note: null },
              {
                AND: [
                  { NOT: { delivery_note: { contains: "self", mode: "insensitive" } } },
                  { NOT: { delivery_note: { contains: "pickup", mode: "insensitive" } } },
                  { NOT: { delivery_note: { contains: "takeaway", mode: "insensitive" } } },
                  { NOT: { delivery_note: { contains: "booking", mode: "insensitive" } } },
                  { NOT: { delivery_note: { contains: "shop", mode: "insensitive" } } },
                  { NOT: { delivery_note: { contains: "comes", mode: "insensitive" } } },
                ]
              }
            ]
          }
        }
      },
      orderBy: { created_at: "asc" },
      take: 50,
      include: {
        customer: { select: { name: true, phone: true, avatar_url: true } },
        address: true,
        orders: {
          include: {
            vendor: { select: { id: true, business_name: true, latitude: true, longitude: true, phone: true } },
            items: true,
          }
        },
      }
    });

    // ── MULTI-VENDOR ONLY ──────────────────────────────────────────────
    // The delivery panel must only show orders that span multiple vendors.
    // Single-vendor orders are handled directly by the vendor's own
    // delivery mechanism and should NOT appear on the delivery partner radar.
    const multiVendorRows = rows.filter((m: any) => {
      const uniqueVendorIds = new Set(m.orders.map((o: any) => o.vendor_id));
      return uniqueVendorIds.size > 1;
    });

    return multiVendorRows.map((m: any) => {
      const items = m.orders.flatMap((o: any) => o.items);
      const vendors = m.orders.map((o: any) => o.vendor);
      
      return {
        id: m.id,
        order_number: m.order_number,
        status: m.status,
        delivery_fee: m.delivery_fee,
        items_subtotal: m.total_amount,
        tax: m.tax,
        discount: 0,
        total: m.total_amount,
        delivery_note: m.orders[0]?.delivery_note,
        payment_method: m.payment_method,
        payment_status: m.payment_status,
        otp_code: m.orders[0]?.otp_code,
        created_at: m.created_at,
        payment: m.orders[0]?.payment,
        items: items,
        vendor: { business_name: `${vendors.length} Stores`, address: "Multiple Pickup Locations" },
        sub_orders: m.orders.map((o: any) => ({
           id: o.id,
           order_number: o.order_number,
           status: o.status,
           vendor: o.vendor,
           total: o.total,
           items: o.items,
        })),
        customer: m.customer,
        address: m.address,
      };
    });
  },

  async listMyDeliveries(userId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const rows = await prisma.masterOrder.findMany({
      where: { delivery_partner_id: partner.id },
      orderBy: { created_at: "desc" },
      include: {
        customer: { select: { name: true, phone: true, avatar_url: true } },
        address: true,
        orders: {
          include: {
            vendor: { select: { id: true, business_name: true, latitude: true, longitude: true, phone: true } },
            items: true,
            payment: { select: { amount: true, method: true, status: true, gateway_response: true } },
          }
        },
      }
    });

    return rows.map((m: any) => {
      const items = m.orders.flatMap((o: any) => o.items);
      const vendors = m.orders.map((o: any) => o.vendor);
      
      return {
        id: m.id,
        order_number: m.order_number,
        status: m.status,
        delivery_fee: m.delivery_fee,
        items_subtotal: m.total_amount,
        tax: m.tax,
        discount: 0,
        total: m.total_amount,
        delivery_note: m.orders[0]?.delivery_note,
        payment_method: m.payment_method,
        payment_status: m.payment_status,
        otp_code: m.orders[0]?.otp_code,
        created_at: m.created_at,
        payment: m.orders[0]?.payment,
        items: items,
        vendor: vendors.length === 1 ? vendors[0] : { business_name: `${vendors.length} Stores`, address: "Multiple Pickup Locations" },
        vendors: vendors,
        sub_orders: m.orders.map((o: any) => ({
           id: o.id,
           order_number: o.order_number,
           status: o.status,
           vendor: o.vendor,
           total: o.total,
           items: o.items,
        })),
        customer: m.customer,
        address: m.address,
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
    
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        orders: true,
        customer: true
      }
    });
    
    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    if (masterOrder.delivery_partner_id) {
      throw new ConflictError(
        "This order already has a delivery partner assigned.",
      );
    }
    
    // allow picking up unless order specifies self-pickup etc (if needed)
    
    if (
      requiresUpfrontPayment(masterOrder.payment_method) &&
      masterOrder.payment_status !== "PAID"
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Order payment is not complete.",
        { code: "ORDER_PAYMENT_REQUIRED" },
      );
    }

    const claimWhere: Prisma.MasterOrderWhereInput = {
      id: orderId,
      delivery_partner_id: null,
      orders: {
        some: {
          status: ACCEPTABLE_DELIVERY_ASSIGNMENT_FILTER,
        }
      }
    };
    if (requiresUpfrontPayment(masterOrder.payment_method)) {
      claimWhere.payment_status = "PAID";
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.masterOrder.updateMany({
        where: claimWhere,
        data: { delivery_partner_id: partner.id },
      });
      if (claimed.count === 0) {
        throw new ConflictError(
          "This order already has a delivery partner assigned.",
        );
      }
      
      for (const order of masterOrder.orders) {
          if (ACCEPTABLE_DELIVERY_ASSIGNMENT_STATUSES.includes(order.status as any)) {
             await tx.order.update({
               where: { id: order.id },
               data: { delivery_partner_id: partner.id, eta_minutes: etaMinutes }
             });
             await tx.orderEvent.create({
                data: {
                  order_id: order.id,
                  status: order.status,
                  note: `Delivery partner accepted the order. ETA: ${etaMinutes} mins.`,
                  actor_type: "delivery",
                  actor_id: userId,
                },
             });
          }
      }
      return masterOrder;
    });

    if (!updated) {
      throw new NotFoundError("Order not found.");
    }
    
    for (const order of masterOrder.orders) {
       await prisma.deliveryTracking.upsert({
         where: { order_id: order.id },
         update: {},
         create: { order_id: order.id, status: "CONFIRMED" },
       });
    }

    const partnerProfileWithUser = await prisma.deliveryProfile.findUnique({
      where: { id: partner.id },
      include: { user: { select: { name: true, phone: true } } }
    });
    const partnerName = partnerProfileWithUser?.user?.name || "Delivery Partner";
    const partnerPhone = partnerProfileWithUser?.user?.phone || null;

    // Notify Customer
    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      "Delivery partner assigned 🚴",
      `${partnerName} is on the way to pick up your order! Estimated arrival: ${etaMinutes} mins.`,
      { order_id: masterOrder.id, eta_minutes: etaMinutes },
    );

    // Push real-time update to customer's tracking page
    realtime.publishOrderStatus(masterOrder.id, "PARTNER_ASSIGNED");

    // Notify each vendor store in the order & broadcast realtime WebSocket alert
    for (const order of masterOrder.orders) {
      if (order.vendor_id) {
        await notificationService.orderStatus(
          order.vendor_id,
          order.order_number,
          "Delivery Partner Assigned",
          `Rider ${partnerName} accepted order #${order.order_number}. Arriving for pickup in ~${etaMinutes} mins.`,
          { order_id: order.id, eta_minutes: etaMinutes }
        ).catch(() => {});

        realtime.publishDeliveryAssigned(order.vendor_id, {
          order_id: order.id,
          order_number: order.order_number,
          eta_minutes: etaMinutes,
          delivery_partner: {
            id: partner.id,
            name: partnerName,
            phone: partnerPhone,
            vehicle_type: partner.vehicle_type,
            vehicle_number: partner.vehicle_number,
          },
        });
      }
    }
    
    await auditService.record(
      {
        userId,
        action: "ORDER_PLACED" as any, // fallback to a known audit action
        entityType: "masterOrder",
        entityId: orderId,
        newValues: { delivery_partner_id: partner.id },
      },
      req,
    );

    await this.updateDeliveryLocation(userId, {
      lat: partner.current_lat ?? 0,
      lng: partner.current_lng ?? 0,
      orderId: orderId,
    } as any);
  },

  async updateDeliveryStatus(
    userId: string,
    orderId: string,
    input: DeliveryOrderStatusBody,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    const statusInput = input.status;
    const note = (input as any).note;
    
    const status = statusInput.toUpperCase();

    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: true }
    });
    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    if (masterOrder.delivery_partner_id !== partner.id) {
      throw new ForbiddenError("You are not assigned to this order.");
    }

    if (status === "OUT_FOR_DELIVERY" && masterOrder.orders.some((o: any) => o.status !== "PICKED_UP" && o.status !== "OUT_FOR_DELIVERY" && o.status !== "CANCELLED" && o.status !== "DELIVERED")) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Cannot start delivery. You must confirm pickup from all active stores first.",
        { code: "NOT_ALL_PICKED_UP" },
      );
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.masterOrder.update({
        where: { id: orderId },
        data: { status: status as any },
      });
      
      for (const order of masterOrder.orders) {
         await tx.order.update({
           where: { id: order.id },
           data: { status: status as any },
         });
         await tx.orderEvent.create({
           data: {
             order_id: order.id,
             status: status as any,
             note: note || `Status updated to ${status}`,
             actor_type: "delivery",
             actor_id: userId,
           },
         });
         await tx.deliveryTracking.upsert({
           where: { order_id: order.id },
           update: { status: status as any },
           create: { order_id: order.id, status: status as any },
         });
      }
    });

    // Build a friendly, descriptive customer notification for each status
    const statusMessages: Record<string, { title: string; body: string }> = {
      CONFIRMED: {
        title: "Order confirmed ✅",
        body: `Your order #${masterOrder.order_number} has been confirmed by the vendor.`,
      },
      PREPARING: {
        title: "Order being prepared 🍳",
        body: `The vendor is preparing your order #${masterOrder.order_number}. Sit tight!`,
      },
      PACKED: {
        title: "Order packed 📦",
        body: `Your order #${masterOrder.order_number} is packed and waiting for pickup.`,
      },
      READY_FOR_PICKUP: {
        title: "Ready for pickup 🏪",
        body: `Your order #${masterOrder.order_number} is ready! The delivery partner will pick it up soon.`,
      },
      PICKED_UP: {
        title: "Order picked up 🚴",
        body: `Your items from order #${masterOrder.order_number} have been picked up!`,
      },
      OUT_FOR_DELIVERY: {
        title: "Out for delivery 🛵",
        body: `Your order #${masterOrder.order_number} is on its way to you!`,
      },
    };

    const msg = statusMessages[status] ?? {
      title: "Order update",
      body: `Your order #${masterOrder.order_number} is now ${status.replace(/_/g, " ").toLowerCase()}.`,
    };

    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      msg.title,
      msg.body,
      { order_id: orderId },
    );

    // Push real-time update to customer's tracking page
    realtime.publishOrderStatus(orderId, status);
  },

  async updateDeliveryLocation(userId: string, input: DeliveryLocationBody & { orderId?: string }) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    await deliveryRepo.updateDelivery(partner.id, {
      current_lat: input.lat,
      current_lng: input.lng,
    });
    
    // We will find the active master orders if no explicit orderId
    const activeOrders = await prisma.order.findMany({
      where: {
        delivery_partner_id: partner.id,
        status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      },
      select: { id: true, master_order_id: true },
    });
    
    for (const order of activeOrders) {
      await prisma.deliveryTracking.upsert({
        where: { order_id: order.id },
        update: { driver_lat: input.lat, driver_lng: input.lng },
        create: {
          order_id: order.id,
          status: "CONFIRMED",
          driver_lat: input.lat,
          driver_lng: input.lng,
        },
      });
      
    }
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
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: { include: { vendor: true, items: true } } }
    });
    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    if (masterOrder.delivery_partner_id !== partner.id) {
      throw new ForbiddenError("You are not assigned to this order.");
    }
    
    const firstOrder = masterOrder.orders[0];
    if (!firstOrder) throw new NotFoundError("Order has no sub-orders.");
    
    if (firstOrder.otp_code && firstOrder.otp_code !== input.otp) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid OTP.", {
        code: "INVALID_OTP",
      });
    }

    const activeOrders = masterOrder.orders.filter(o => o.status !== "CANCELLED" && o.status !== "FAILED");
    
    for (const order of activeOrders) {
      await completeDelivery({
        orderId: order.id,
        otp: "",
        skipOtp: true,
        allowedStates: ["OUT_FOR_DELIVERY"],
        note: "Delivered by partner.",
        actorType: "delivery",
        actorId: userId,
        partnerId: partner.id,
      });
    }

    await prisma.masterOrder.update({
      where: { id: orderId },
      data: { status: "DELIVERED" }
    });

    const uniqueVendors = new Set(activeOrders.map(o => o.vendor_id)).size;
    const bonus = uniqueVendors > 1 ? (uniqueVendors - 1) * 10 : 0;
    
    const firstActive = activeOrders[0];
    if (bonus > 0 && firstActive) {
      await prisma.deliveryEarning.create({
        data: {
          delivery_partner_id: partner.id,
          order_id: firstActive.id,
          amount: bonus,
          type: "BONUS",
          reference_id: `earning-BONUS-${masterOrder.order_number}`,
        },
      });
    }

    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      "Order delivered 🎉",
      `Your order #${masterOrder.order_number} has been delivered successfully. Enjoy!`,
      { order_id: orderId },
    );

    // Push real-time update to customer's tracking page
    realtime.publishOrderStatus(orderId, "DELIVERED");
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
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        orders: {
          include: { vendor: true }
        }
      }
    });

    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    
    let canSeeDriverInfo = false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
       canSeeDriverInfo = true;
    } else if (user.role === "CUSTOMER") {
       if (masterOrder.user_id !== user.id) throw new ForbiddenError("You can only track your own orders.");
       canSeeDriverInfo = true;
    } else if (user.role === "DELIVERY") {
       const partner = await deliveryRepo.findByUserId(user.id);
       if (!partner || masterOrder.delivery_partner_id !== partner.id) throw new ForbiddenError("You are not assigned to this delivery.");
       canSeeDriverInfo = false;
    } else if (user.role === "VENDOR") {
       const vendor = await vendorRepo.findByUserId(user.id);
       if (!masterOrder.orders.some((o: any) => o.vendor_id === vendor?.id)) throw new ForbiddenError("You do not have access to this delivery.");
       canSeeDriverInfo = true;
    } else {
       throw new ForbiddenError("You do not have permission to track this delivery.");
    }

    const address = await addressRepo.findById(masterOrder.address_id);
    
    const firstOrder = masterOrder.orders[0];
    const tracking = firstOrder ? await prisma.deliveryTracking.findUnique({ where: { order_id: firstOrder.id } }) : null;
    
    let driverInfo = null;
    if (canSeeDriverInfo && masterOrder.delivery_partner_id) {
      const partner = await prisma.deliveryProfile.findUnique({
        where: { id: masterOrder.delivery_partner_id },
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
    
    const vendors = masterOrder.orders.map((o: any) => o.vendor);

    return {
      order_id: orderId,
      status: tracking?.status ?? masterOrder.status,
      current_lat: tracking?.driver_lat ?? null,
      current_lng: tracking?.driver_lng ?? null,
      heading: (tracking as any)?.heading ?? null,
      speed: (tracking as any)?.speed ?? null,
      eta_minutes: (tracking as any)?.eta_minutes ?? null,
      distance_km: (tracking as any)?.distance_km ?? null,
      last_updated_at: tracking?.updated_at ?? null,
      pickup_location: {
        lat: vendors[0]?.latitude ?? null,
        lng: vendors[0]?.longitude ?? null,
        address: vendors.length === 1 ? vendors[0]?.full_address : "Multiple Stores",
        name: vendors.length === 1 ? vendors[0]?.business_name : "Multiple Stores",
      },
      delivery_location: {
        lat: address?.latitude ?? null,
        lng: address?.longitude ?? null,
        address: address?.full_address ?? [address?.landmark, address?.city, address?.pincode].filter(Boolean).join(", "),
      },
      driver: driverInfo,
    };
  },

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

    // Completed Trips Count (exclude REFUND rows — FLAW 12 FIX)
    const completedTripsCount = await prisma.deliveryEarning.count({
      where: { delivery_partner_id: deliveryPartnerId, type: { not: "REFUND" } },
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
   *
   * FLAW 1 FIX: Uses Prisma interactive transaction with `SELECT ... FOR UPDATE`
   * on the delivery partner row to prevent concurrent double-spend.
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

    // FLAW 1 FIX: Atomic balance check + withdrawal creation with row-level lock
    const request = await prisma.$transaction(async (tx) => {
      // Acquire advisory lock on the delivery partner row
      await tx.$queryRawUnsafe(
        `SELECT id FROM delivery_profiles WHERE id = $1 FOR UPDATE`,
        deliveryPartnerId
      );

      // Compute available balance within the transaction
      const settledAgg = await tx.deliveryEarning.aggregate({
        where: { delivery_partner_id: deliveryPartnerId, status: "SETTLED" },
        _sum: { amount: true },
      });
      const completedWithdrawalsAgg = await (tx as any).payoutRequest.aggregate({
        where: { delivery_partner_id: deliveryPartnerId, status: "COMPLETED" },
        _sum: { amount: true },
      });
      const inFlightWithdrawalsAgg = await (tx as any).payoutRequest.aggregate({
        where: {
          delivery_partner_id: deliveryPartnerId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        _sum: { amount: true },
      });

      const totalSettled = Number(settledAgg._sum.amount ?? 0);
      const totalWithdrawn = Number(completedWithdrawalsAgg._sum.amount ?? 0);
      const inFlight = Number(inFlightWithdrawalsAgg._sum.amount ?? 0);
      const netBalance = Math.round((totalSettled - totalWithdrawn - inFlight) * 100) / 100;
      const availableBalance = Math.max(0, netBalance);

      if (requestedAmount > availableBalance) {
        throw new Error(`Insufficient available balance. Maximum withdrawable: ₹${availableBalance.toFixed(2)}`);
      }

      return (tx as any).payoutRequest.create({
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
    });

    // Notify outside the transaction (non-critical)
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
