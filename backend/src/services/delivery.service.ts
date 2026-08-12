
import * as roleRepo from "../repositories/role.repository";
import * as userRepo from "../repositories/user.repository";
import * as orderRepo from "../repositories/order.repository";
import { realtime } from "../realtime/realtime";
import { notificationService } from "./notification.service";
import { ROLES } from "../constants/roles";
import { ConflictError, ForbiddenError } from "../utils/ApiError";
import type { DeliveryRegisterBody, DeliveryApplyBody, DeliveryOrderStatusBody, DeliveryLocationBody, DeliveredOtpBody, DeliveryKycBody } from "../validators/integration.validators";

async function upgradeRole(userId: string, slug: string): Promise<void> {
  const role = await roleRepo.findBySlug(slug);
  if (!role) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Role not found.", { code: "ROLE_NOT_FOUND" });
  }
  await userRepo.changeRole(userId, role.id);
}

async function getKyc(userId: string, type: string) {
  return prisma.kycRecord.findUnique({ where: { user_id_type: { user_id: userId, type } } });
}

// If a soft-deleted profile already exists for this user (deleted account re-registered),
// restore it instead of failing on the unique user_id. Otherwise create a fresh one.
async function restoreOrCreateProfile(
  userId: string,
  input: { vehicle_type: string; vehicle_number?: string; license_number?: string }
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
        vehicle_number: input.vehicle_number && input.vehicle_number.trim() ? input.vehicle_number : "NA",
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
      vehicle_number: input.vehicle_number && input.vehicle_number.trim() ? input.vehicle_number : "NA",
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
  delivered: "DELIVERED",
};

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as deliveryRepo from "../repositories/delivery.repository";
import { cacheService } from "../database/cache";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

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
        where: { delivery_partner_id: partner.id, status: "DELIVERED", deleted_at: null },
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

  async getMyEarnings(userId: string, query: { period?: string; page?: number; per_page?: number }) {
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
      throw new ApiError(HttpStatus.BAD_REQUEST, "Delivery partner must be approved.", {
        code: "DELIVERY_NOT_APPROVED",
      });
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
        newValues: { is_available: isAvailable, availability_status: availabilityStatus },
      },
      req
    );

    return {
      id: updated.id,
      is_available: updated.is_available,
      availability_status: updated.availability_status,
    };
  },

  async updateProfile(userId: string, input: Record<string, unknown>, req: Request) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const allowed = ["vehicle_type", "vehicle_number", "license_number"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in input && input[key] !== undefined) {
        data[key] = input[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return partner;
    }

    const updated = await deliveryRepo.updateDelivery(partner.id, data as never);
    await cacheService.invalidateNamespace("delivery");
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: data,
      },
      req
    );

    return updated;
  },
  // ---------------------------------------------------------------------------
  // Delivery partner module
  // ---------------------------------------------------------------------------
  async registerDelivery(userId: string, input: DeliveryRegisterBody, req: Request) {
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
      { userId, action: AUDIT_ACTIONS.DELIVERY_REGISTERED, entityType: "delivery", entityId: partner.id, newValues: { vehicle_type: input.vehicle_type } },
      req
    );
    return partner;
  },

  async applyDelivery(userId: string, input: DeliveryApplyBody, req: Request) {
    const existing = await deliveryRepo.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const userUpdates: Record<string, string> = {};
    if (typeof input.full_name === "string" && input.full_name.trim().length > 0) {
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
      { userId, action: AUDIT_ACTIONS.DELIVERY_REGISTERED, entityType: "delivery", entityId: partner.id, newValues: { vehicle_type: input.vehicle_type } },
      req
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
        status: { in: ["CONFIRMED", "READY_FOR_PICKUP"] },
        vendor: { is: { status: "APPROVED" } },
      },
      orderBy: { created_at: "asc" },
      take: 50,
      select: {
        id: true,
        order_number: true,
        delivery_fee: true,
        total: true,
        created_at: true,
        vendor: { select: { business_name: true, address: true, city: true } },
        customer: { select: { id: true, name: true, phone: true } },
        address: { select: { full_address: true, city: true, state: true, pincode: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      order_number: r.order_number,
      delivery_fee: r.delivery_fee.toNumber(),
      total_amount: r.total.toNumber(),
      created_at: r.created_at,
      vendor: r.vendor,
      user: r.customer,
      address: { ...r.address, street_address: r.address.full_address },
    }));
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
        total: true,
        delivery_fee: true,
        otp_code: true,
        created_at: true,
        vendor: { select: { business_name: true, address: true, city: true, latitude: true, longitude: true } },
        customer: { select: { id: true, name: true, phone: true } },
        address: { select: { full_address: true, city: true, state: true, pincode: true, latitude: true, longitude: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      order_number: r.order_number,
      status: r.status.toLowerCase(),
      total_amount: r.total.toNumber(),
      delivery_fee: r.delivery_fee.toNumber(),
      created_at: r.created_at,
      vendor: r.vendor,
      user: r.customer,
      address: { ...r.address, street_address: r.address.full_address },
    }));
  },

  async acceptDelivery(userId: string, orderId: string, etaMinutes: number, req: Request) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    if (partner.status !== "APPROVED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Delivery partner must be approved.", { code: "DELIVERY_NOT_APPROVED" });
    }
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.delivery_partner_id) {
      throw new ConflictError("This order already has a delivery partner assigned.");
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderEvent.create({
        data: {
          order_id: orderId,
          status: "CONFIRMED",
          note: `Delivery partner accepted the order. ETA: ${etaMinutes} mins.`,
          actor_type: "delivery",
          actor_id: userId,
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: { delivery_partner_id: partner.id, eta_minutes: etaMinutes },
        select: { id: true, order_number: true, status: true, total: true, user_id: true },
      });
    });
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
      { order_id: orderId }
    );
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.DELIVERY_ACCEPTED, entityType: "order", entityId: orderId, newValues: { partner_id: partner.id } },
      req
    );
    realtime.publishOrderStatus(orderId, updated.status);
    return updated;
  },

  async updateDeliveryStatus(userId: string, orderId: string, input: DeliveryOrderStatusBody) {
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
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid delivery status.", { code: "INVALID_STATUS" });
    }
    const timestamps: Record<string, Date> = {};
    if (mapped === "PICKED_UP") timestamps.picked_up_at = new Date();
    if (mapped === "OUT_FOR_DELIVERY") timestamps.started_at = new Date();
    if (mapped === "DELIVERED") timestamps.delivered_at = new Date();

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
      { order_id: orderId }
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
        create: { order_id: order.id, driver_lat: input.lat, driver_lng: input.lng },
      });
      realtime.publishOrderLocation(order.id, input.lat, input.lng);
    }
    return updated;
  },

  async markDelivered(userId: string, orderId: string, input: DeliveredOtpBody) {
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
    if (!order.otp_code || order.otp_code !== input.otp) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid delivery OTP.", { code: "INVALID_OTP" });
    }
    const updated = await orderRepo.updateOrderStatus(orderId, {
      status: "DELIVERED",
      note: "Order delivered.",
      actorType: "delivery",
      actorId: userId,
      timestamps: { delivered_at: new Date() },
    });
    await prisma.deliveryTracking.upsert({
      where: { order_id: orderId },
      update: { status: "DELIVERED" },
      create: { order_id: orderId, status: "DELIVERED" },
    });
    await notificationService.orderStatus(
      order.user_id,
      order.order_number,
      "Order delivered",
      "Your order has been delivered. Enjoy your groceries!",
      { order_id: orderId }
    );
    realtime.publishOrderStatus(orderId, "DELIVERED");
    return updated;
  },

  async submitDeliveryKyc(userId: string, input: DeliveryKycBody, req: Request) {
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
      { userId, action: AUDIT_ACTIONS.KYC_SUBMITTED, entityType: "kyc", entityId: kyc.id, newValues: { type: "delivery", status: kyc.status } },
      req
    );
    return kyc;
  },

  async getDeliveryTracking(orderId: string) {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    const [tracking, address, vendor] = await Promise.all([
      prisma.deliveryTracking.findUnique({ where: { order_id: orderId } }),
      addressRepo.findById(order.address_id),
      vendorRepo.findById(order.vendor_id),
    ]);
    let driverInfo = null;
    if (order.delivery_partner_id) {
      const partner = await prisma.deliveryProfile.findUnique({ where: { id: order.delivery_partner_id } });
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
      driver_location: tracking?.driver_lat != null && tracking?.driver_lng != null
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
      eta: tracking?.eta_minutes != null ? `${tracking.eta_minutes} min` : order.eta_minutes != null ? `${order.eta_minutes} min` : null,
      driver_info: driverInfo,
      order_status: order.status,
    };
  },


};
