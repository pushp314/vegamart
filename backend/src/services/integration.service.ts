import type { Request } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";
import { ROLES } from "../constants/roles";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { vendorService } from "./vendor.service";
import { orderService } from "./order.service";
import { cartService } from "./cart.service";
import { checkoutService } from "./checkout.service";
import { addressService } from "./address.service";
import { notificationService } from "./notification.service";
import * as vendorRepo from "../repositories/vendor.repository";
import * as deliveryRepo from "../repositories/delivery.repository";
import * as orderRepo from "../repositories/order.repository";
import * as userRepo from "../repositories/user.repository";
import * as roleRepo from "../repositories/role.repository";
import * as productRepo from "../repositories/product.repository";
import * as addressRepo from "../repositories/address.repository";
import { ApiError, ConflictError, ForbiddenError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { realtime } from "../realtime/realtime";
import type {
  CreateOrderAliasBody,
  DeliveredOtpBody,
  DeliveryKycBody,
  DeliveryLocationBody,
  DeliveryOrderStatusBody,
  DeliveryRegisterBody,
  RingBellBody,
  VendorKycBody,
  VendorRegisterBody,
} from "../validators/integration.validators";

const ORDER_STATUS_MAP: Record<string, string> = {
  accepted: "CONFIRMED",
  preparing: "PREPARING",
  packed: "PACKED",
  ready_for_pickup: "READY_FOR_PICKUP",
  picked_up: "PICKED_UP",
  out_for_delivery: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
};

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

async function getMyVendorOrFail(userId: string): Promise<vendorRepo.VendorRow> {
  return vendorService.getMyVendor(userId);
}

export const integrationService = {
  // ---------------------------------------------------------------------------
  // Checkout alias: POST /checkout/create-order
  // ---------------------------------------------------------------------------
  async createOrder(userId: string, input: CreateOrderAliasBody, req: Request) {
    const method = input.payment_method === "cod" ? "COD" : "RAZORPAY";
    const result = await checkoutService.placeOrder(
      userId,
      {
        address_id: input.address_id,
        coupon_code: input.coupon_code,
        payment_method: method,
        idempotency_key: input.idempotency_key,
      },
      req
    );

    const first = result.orders[0];
    const payment = first?.payment;

    for (const { order, payment: p } of result.orders) {
      realtime.publishOrderStatus(order.id, order.status);
      if (p && p.method === "COD") {
        realtime.publishOrderEta(order.id, order.eta_minutes ?? 30);
      }
    }

    return {
      id: first?.order.id ?? null,
      order_number: first?.order.order_number ?? null,
      status: first?.order.status ?? null,
      total: first?.order.total?.toNumber() ?? 0,
      delivery_fee: first?.order.delivery_fee?.toNumber() ?? 0,
      payment_method: first?.order.payment_method ?? method,
      razorpay_order_id: payment?.razorpay_order_id ?? null,
      summary: result.summary,
      orders: result.orders.map(({ order, payment: p }) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total: order.total.toNumber(),
        razorpay_order_id: p?.razorpay_order_id ?? null,
      })),
    };
  },

  // ---------------------------------------------------------------------------
  // Orders aliases
  // ---------------------------------------------------------------------------
  async listVendorOrders(userId: string, query: { page?: number; per_page?: number; status?: string }) {
    return orderService.listVendorOrders(userId, query);
  },

  async reorder(userId: string, orderId: string, req: Request) {
    const detail = await orderRepo.findById(orderId);
    if (!detail) {
      throw new NotFoundError("Order not found.");
    }
    if (detail.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }
    for (const item of detail.items) {
      await cartService.addItem(userId, { product_id: item.product_id, quantity: item.quantity }, req);
    }
    return { reordered_items: detail.items.length };
  },

  async requestReturn(userId: string, orderId: string, req: Request) {
    const detail = await orderRepo.findById(orderId);
    if (!detail) {
      throw new NotFoundError("Order not found.");
    }
    if (detail.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }
    if (!["DELIVERED", "CONFIRMED"].includes(detail.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order cannot be returned in its current state.", {
        code: "ORDER_NOT_RETURNABLE",
      });
    }
    const updated = await orderRepo.updateOrderStatus(orderId, {
      status: "RETURNED",
      note: "Return requested by customer.",
      actorType: "customer",
      actorId: userId,
    });
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_RETURNED, entityType: "order", entityId: orderId, newValues: { status: updated.status } },
      req
    );
    return updated;
  },

  // ---------------------------------------------------------------------------
  // Vendor self-service aliases
  // ---------------------------------------------------------------------------
  async registerVendor(userId: string, input: VendorRegisterBody, req: Request) {
    const existing = await vendorRepo.findByUserId(userId);
    if (existing) {
      return existing;
    }
    const user = await userRepo.findById(userId, { role: true });
    if (user?.role.slug !== ROLES.VENDOR) {
      await upgradeRole(userId, ROLES.VENDOR);
    }
    const vendor = await vendorService.create(userId, { ...input, roaming: input.vendor_type === "roaming" || input.vendor_type === "both" ? true : (input.roaming ?? false) }, req);
    return vendor;
  },

  async updateMyProfile(userId: string, body: Record<string, unknown>, req: Request) {
    const vendor = await getMyVendorOrFail(userId);
    const allowed = [
      "business_name",
      "description",
      "category",
      "tags",
      "logo_url",
      "banner_url",
      "address",
      "landmark",
      "city",
      "state",
      "country",
      "pincode",
      "latitude",
      "longitude",
      "delivery_radius_km",
      "business_hours",
      "min_order",
      "delivery_fee",
      "owner_name",
      "phone",
      "available_from",
      "available_to",
      "subscription_plan",
    ];
    const clean: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) clean[key] = body[key];
    }
    if (clean.subscription_plan !== undefined) {
      delete clean.subscription_plan;
    }
    if (Object.keys(clean).length === 0) {
      return vendor;
    }
    return vendorService.update(userId, clean as never, req);
  },

  async toggleAvailability(userId: string, isOpen: boolean, req: Request) {
    return vendorService.setAvailability(userId, isOpen, req);
  },

  async submitVendorKyc(userId: string, input: VendorKycBody, req: Request) {
    await getMyVendorOrFail(userId);
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
    await getMyVendorOrFail(userId);
    const kyc = await getKyc(userId, "vendor");
    return kyc;
  },

  async getVendorEarnings(userId: string) {
    const vendor = await getMyVendorOrFail(userId);
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
    const partner = await prisma.deliveryProfile.create({
      data: {
        user_id: userId,
        vehicle_type: input.vehicle_type,
        vehicle_number: input.vehicle_number,
        license_number: input.license_number ?? "",
        status: "PENDING",
        is_verified: false,
        is_available: false,
        availability_status: "OFFLINE",
      },
    });
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
        user: { select: { id: true, name: true, phone: true } },
        address: { select: { street_address: true, city: true, state: true, pincode: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      order_number: r.order_number,
      delivery_fee: r.delivery_fee.toNumber(),
      total_amount: r.total.toNumber(),
      created_at: r.created_at,
      vendor: r.vendor,
      user: r.user,
      address: r.address,
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
        user: { select: { id: true, name: true, phone: true } },
        address: { select: { street_address: true, city: true, state: true, pincode: true, latitude: true, longitude: true } },
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
      user: r.user,
      address: r.address,
    }));
  },

  async acceptDelivery(userId: string, orderId: string, req: Request) {
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
          note: "Delivery partner accepted the order.",
          actor_type: "delivery",
          actor_id: userId,
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: { delivery_partner_id: partner.id },
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

  async updateDeliveryLocation(userId: string, input: DeliveryLocationBody, orderId?: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const updated = await deliveryRepo.updateDelivery(partner.id, {
      current_lat: input.lat,
      current_lng: input.lng,
    });
    if (orderId) {
      const order = await orderRepo.findById(orderId);
      if (order && order.delivery_partner_id === partner.id) {
        await prisma.deliveryTracking.upsert({
          where: { order_id: orderId },
          update: { driver_lat: input.lat, driver_lng: input.lng },
          create: { order_id: orderId, driver_lat: input.lat, driver_lng: input.lng },
        });
        realtime.publishOrderLocation(orderId, input.lat, input.lng);
      }
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
    if (order.otp_code && order.otp_code !== input.otp) {
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

  // ---------------------------------------------------------------------------
  // Browse: banners / offers / faqs / trending / recently-viewed / recommended
  // ---------------------------------------------------------------------------
  async listBanners() {
    return prisma.cmsBanner.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
  },

  async listOffers() {
    const now = new Date();
    return prisma.cmsOffer.findMany({
      where: { is_active: true, OR: [{ valid_until: null }, { valid_until: { gte: now } }] },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
  },

  async listFaqs() {
    return prisma.cmsFaq.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
  },

  async listTrendingProducts() {
    const { rows } = await productRepo.listProducts(
      { isAvailable: true, sort: "rating" },
      0,
      10
    );
    return rows;
  },

  async addRecentlyViewed(userId: string, productId: string) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError("Product not found.");
    }
    await prisma.recentlyViewed.upsert({
      where: { user_id_product_id: { user_id: userId, product_id: productId } },
      update: { viewed_at: new Date() },
      create: { user_id: userId, product_id: productId },
    });
    const keep = await prisma.recentlyViewed.findMany({
      where: { user_id: userId },
      orderBy: { viewed_at: "desc" },
      take: 20,
      select: { id: true },
    });
    const keepIds = keep.map((k) => k.id);
    await prisma.recentlyViewed.deleteMany({
      where: { user_id: userId, NOT: { id: { in: keepIds } } },
    });
    return { ok: true };
  },

  async listRecentlyViewed(userId: string) {
    const rows = await prisma.recentlyViewed.findMany({
      where: { user_id: userId },
      orderBy: { viewed_at: "desc" },
      take: 20,
      select: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            mrp: true,
            unit: true,
            tag: true,
            is_vegetarian: true,
            rating: true,
            review_count: true,
            images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
            vendor: { select: { id: true, business_name: true } },
          },
        },
        viewed_at: true,
      },
    });
    return rows.map((r) => ({
      viewed_at: r.viewed_at,
      product: {
        id: r.product.id,
        name: r.product.name,
        slug: r.product.slug,
        price: r.product.price.toNumber(),
        mrp: r.product.mrp.toNumber(),
        unit: r.product.unit,
        tag: r.product.tag,
        is_vegetarian: r.product.is_vegetarian,
        rating: r.product.rating,
        review_count: r.product.review_count,
        image: r.product.images[0]?.url ?? null,
        vendor_id: r.product.vendor.id,
        vendor_name: r.product.vendor.business_name,
      },
    }));
  },

  async listRecommended(userId: string) {
    const viewed = await prisma.recentlyViewed.findMany({
      where: { user_id: userId },
      orderBy: { viewed_at: "desc" },
      take: 10,
      select: { product: { select: { id: true, category_id: true, vendor_id: true } } },
    });
    const cart = await prisma.cart.findUnique({
      where: { user_id: userId },
      select: { items: { select: { product: { select: { id: true, category_id: true, vendor_id: true } } } } },
    });

    const categoryIds = new Set<string>();
    const vendorIds = new Set<string>();
    const excluded = new Set<string>();
    for (const v of viewed) {
      excluded.add(v.product.id);
      if (v.product.category_id) categoryIds.add(v.product.category_id);
      if (v.product.vendor_id) vendorIds.add(v.product.vendor_id);
    }
    for (const item of cart?.items ?? []) {
      excluded.add(item.product.id);
      if (item.product.category_id) categoryIds.add(item.product.category_id);
      if (item.product.vendor_id) vendorIds.add(item.product.vendor_id);
    }

    const where: Prisma.ProductWhereInput = { deleted_at: null, is_active: true, is_available: true };
    if (categoryIds.size > 0 || vendorIds.size > 0) {
      where.OR = [
        ...(categoryIds.size > 0 ? [{ category_id: { in: [...categoryIds] } }] : []),
        ...(vendorIds.size > 0 ? [{ vendor_id: { in: [...vendorIds] } }] : []),
      ];
    }
    if (excluded.size > 0) {
      where.NOT = { id: { in: [...excluded] } };
    }

    const rows = await prisma.product.findMany({
      where,
      orderBy: { rating: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        mrp: true,
        unit: true,
        tag: true,
        is_vegetarian: true,
        rating: true,
        review_count: true,
        vendor_id: true,
        images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
        vendor: { select: { business_name: true } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price.toNumber(),
      mrp: p.mrp.toNumber(),
      unit: p.unit,
      tag: p.tag,
      is_vegetarian: p.is_vegetarian,
      rating: p.rating,
      review_count: p.review_count,
      image: p.images[0]?.url ?? null,
      vendor_id: p.vendor_id,
      vendor_name: p.vendor.business_name,
    }));
  },

  // ---------------------------------------------------------------------------
  // Addresses under /users/me (alias to canonical /addresses)
  // ---------------------------------------------------------------------------
  async listMyAddresses(userId: string) {
    return addressService.list(userId);
  },

  async createMyAddress(userId: string, body: Record<string, unknown>) {
    return addressService.create(userId, body as never);
  },

  async updateMyAddress(userId: string, addressId: string, body: Record<string, unknown>) {
    return addressService.update(userId, addressId, body as never);
  },

  async removeMyAddress(userId: string, addressId: string) {
    return addressService.remove(userId, addressId);
  },

  async setDefaultAddress(userId: string, addressId: string) {
    return addressService.setDefault(userId, addressId);
  },
};
