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
import { listVendorEarningsRecent } from "./earning.service";
import * as orderRepo from "../repositories/order.repository";
import * as userRepo from "../repositories/user.repository";
import * as roleRepo from "../repositories/role.repository";
import * as productRepo from "../repositories/product.repository";
import * as addressRepo from "../repositories/address.repository";
import * as settingsRepo from "../repositories/settings.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as refreshTokenRepo from "../repositories/refresh-token.repository";
import { ApiError, ForbiddenError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { realtime } from "../realtime/realtime";
import { calculateStoreAvailability } from "../utils/store-schedule";
import { normalizeCityName } from "../utils/geocoding";
import type {
  CreateOrderAliasBody,
  RingBellBody,
  VendorKycBody,
  VendorRegisterBody,
} from "../validators/integration.validators";

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

    if (input.items && input.items.length > 0) {
      await cartService.clear(userId, req);
      for (const item of input.items) {
        await cartService.addItem(userId, { product_id: item.product_id, quantity: item.quantity }, req);
      }
    }

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
      total: first?.order.total ?? 0,
      delivery_fee: first?.order.delivery_fee ?? 0,
      payment_method: first?.order.payment_method ?? method,
      razorpay_order_id: payment?.razorpay_order_id ?? null,
      summary: result.summary,
      orders: result.orders.map(({ order, payment: p }) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total: order.total,
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
    let reorderedItems = 0;
    for (const item of detail.items) {
      try {
        await cartService.addItem(userId, { product_id: item.product_id, quantity: item.quantity }, req);
        reorderedItems++;
      } catch (err: any) {
        if (err.code === "SOLD_OUT" || err.code === "INSUFFICIENT_STOCK" || err.code === "NOT_FOUND") {
          continue;
        }
        throw err;
      }
    }
    return { reordered_items: reorderedItems };
  },

  async requestReturn(userId: string, orderId: string, req: Request) {
    const detail = await orderRepo.findById(orderId);
    if (!detail) {
      throw new NotFoundError("Order not found.");
    }
    if (detail.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }
    if (detail.status !== "DELIVERED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Only delivered orders can be returned.", {
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
      "free_delivery_min_order",
      "provides_delivery",
      "advance_payment_percentage",
      "delivery_options",
      "delivery_configs",
      "estimated_delivery_time",
      "tax_rate",
      "banner_urls",
      "gstin",
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
    const plan = body.subscription_plan;
    if (typeof plan === "string" && plan.trim().length > 0) {
      await settingsRepo.upsertSetting({
        key: `vendor_subscription:${vendor.id}`,
        value: { plan: plan.trim() },
        type: "json",
      });
    }
    delete clean.subscription_plan;
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
  // Browse: banners / offers / faqs / trending / recently-viewed / recommended
  // ---------------------------------------------------------------------------
  async listBanners() {
    const rows = await prisma.cmsBanner.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image_url,
      link: b.link,
      type: b.position,
      position: b.position,
    }));
  },

  async listTrendingProducts(city?: string) {
    const { rows } = await productRepo.listProducts(
      { isAvailable: true, sort: "rating", city },
      0,
      10
    );
    return rows;
  },

  async listFeaturedProducts(city?: string) {
    let { rows } = await productRepo.listProducts(
      { isAvailable: true, isFeatured: true, sort: "featured", city },
      0,
      10
    );
    if (rows.length === 0) {
      const fallback = await productRepo.listProducts(
        { isAvailable: true, sort: "rating", city },
        0,
        10
      );
      rows = fallback.rows;
    }
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

  async listRecentlyViewed(userId: string, city?: string) {
    const cleanCity = (city || "").trim();
    const normCity = normalizeCityName(cleanCity);
    const rows = await prisma.recentlyViewed.findMany({
      where: {
        user_id: userId,
        product: {
          deleted_at: null,
          is_active: true,
          is_available: true,
          vendor: {
            status: "APPROVED",
            deleted_at: null,
            ...(cleanCity ? { city: { contains: normCity || cleanCity, mode: "insensitive" } } : {}),
          },
        },
      },
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
            stock: true,
            is_active: true,
            is_available: true,
            images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
            vendor: {
              select: {
                id: true,
                business_name: true,
                city: true,
                state: true,
                latitude: true,
                longitude: true,
                delivery_radius_km: true,
                is_open: true,
                status: true,
                auto_schedule_enabled: true,
                store_schedule: true,
                manual_override_status: true,
                manual_override_until: true,
              },
            },
          },
        },
        viewed_at: true,
      },
    });
    return rows.map((r) => {
      const availability = calculateStoreAvailability(r.product.vendor);
      return {
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
          stock: r.product.stock,
          is_active: r.product.is_active,
          is_available: r.product.is_available,
          image: r.product.images[0]?.url ?? null,
          vendor_id: r.product.vendor.id,
          vendor_name: r.product.vendor.business_name,
          vendor: {
            id: r.product.vendor.id,
            business_name: r.product.vendor.business_name,
            city: r.product.vendor.city,
            state: r.product.vendor.state,
            latitude: r.product.vendor.latitude,
            longitude: r.product.vendor.longitude,
            delivery_radius_km: r.product.vendor.delivery_radius_km,
            is_open: availability.isOpen,
            status: r.product.vendor.status,
            store_availability: availability,
          },
        },
      };
    });
  },

  async listRecommended(userId: string, city?: string) {
    const cleanCity = (city || "").trim();
    const normCity = normalizeCityName(cleanCity);
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
    const excluded = new Set<string>();
    for (const v of viewed) {
      excluded.add(v.product.id);
      if (v.product.category_id) categoryIds.add(v.product.category_id);
    }
    for (const item of cart?.items ?? []) {
      excluded.add(item.product.id);
      if (item.product.category_id) categoryIds.add(item.product.category_id);
    }

    const where: Prisma.ProductWhereInput = {
      deleted_at: null,
      is_active: true,
      is_available: true,
      vendor: {
        status: "APPROVED",
        deleted_at: null,
        ...(cleanCity ? { city: { contains: normCity || cleanCity, mode: "insensitive" } } : {}),
      },
    };
    if (categoryIds.size > 0) {
      where.category_id = { in: [...categoryIds] };
    }
    if (excluded.size > 0) {
      where.NOT = { id: { in: [...excluded] } };
    }

    let rows = await prisma.product.findMany({
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
        stock: true,
        is_active: true,
        is_available: true,
        vendor_id: true,
        images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
        vendor: {
          select: {
            id: true,
            business_name: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            delivery_radius_km: true,
            is_open: true,
            status: true,
            auto_schedule_enabled: true,
            store_schedule: true,
            manual_override_status: true,
            manual_override_until: true,
          },
        },
      },
    });

    // If category-matched products in the customer's city are empty, show top rated products in that city only
    if (rows.length === 0 && categoryIds.size > 0) {
      delete where.category_id;
      rows = await prisma.product.findMany({
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
          stock: true,
          is_active: true,
          is_available: true,
          vendor_id: true,
          images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
          vendor: {
            select: {
              id: true,
              business_name: true,
              city: true,
              state: true,
              latitude: true,
              longitude: true,
              delivery_radius_km: true,
              is_open: true,
              status: true,
              auto_schedule_enabled: true,
              store_schedule: true,
              manual_override_status: true,
              manual_override_until: true,
            },
          },
        },
      });
    }

    return rows.map((p) => {
      const availability = calculateStoreAvailability(p.vendor);
      return {
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
        stock: p.stock,
        is_active: p.is_active,
        is_available: p.is_available,
        image: p.images[0]?.url ?? null,
        vendor_id: p.vendor_id,
        vendor_name: p.vendor.business_name,
        vendor: {
          id: p.vendor.id,
          business_name: p.vendor.business_name,
          city: p.vendor.city,
          state: p.vendor.state,
          latitude: p.vendor.latitude,
          longitude: p.vendor.longitude,
          delivery_radius_km: p.vendor.delivery_radius_km,
          is_open: availability.isOpen,
          status: p.vendor.status,
          store_availability: availability,
        },
      };
    });
  },

  // ---------------------------------------------------------------------------
  // Addresses under /users/me (alias to canonical /addresses)
  // ---------------------------------------------------------------------------
  mapAddress(address: addressRepo.AddressRow, userName: string) {
    const line1 = address.full_address;
    return {
      id: address.id,
      label: address.label,
      full_name: userName,
      phone: address.phone ?? null,
      line1,
      line2: address.landmark ?? undefined,
      street_address: line1,
      full_address: line1,
      landmark: address.landmark ?? null,
      city: address.city,
      state: address.state,
      country: address.country,
      pincode: address.pincode,
      latitude: address.latitude,
      longitude: address.longitude,
      map_url: address.map_url || (address.latitude && address.longitude ? `https://www.google.com/maps?q=${address.latitude},${address.longitude}` : null),
      exact_location: address.exact_location ?? null,
      is_default: address.is_default,
    };
  },

  async listMyAddresses(userId: string) {
    const [addresses, user] = await Promise.all([
      addressService.list(userId),
      userRepo.findById(userId, {}),
    ]);
    return addresses.map((a) => this.mapAddress(a, user?.name ?? ""));
  },

  async createMyAddress(userId: string, body: Record<string, unknown>) {
    const user = await userRepo.findById(userId, {});
    const line1 = typeof body.line1 === "string" ? body.line1.trim() : "";
    const line2 = typeof body.line2 === "string" ? body.line2.trim() : "";
    const rawFull = [line1, line2].filter(Boolean).join(", ");
    const fullAddress = (rawFull.length > 0 ? rawFull : (typeof body.full_address === "string" ? body.full_address : "Address")).trim().slice(0, 400);

    const lat = typeof body.latitude === "number" ? body.latitude : (body.latitude ? parseFloat(String(body.latitude)) : null);
    const lng = typeof body.longitude === "number" ? body.longitude : (body.longitude ? parseFloat(String(body.longitude)) : null);
    const mapUrl = typeof body.map_url === "string" ? body.map_url.trim().slice(0, 500) : (lat && lng ? `https://www.google.com/maps?q=${lat},${lng}`.slice(0, 500) : null);
    const exactLocation = typeof body.exact_location === "string" ? body.exact_location.trim().slice(0, 500) : null;

    const created = await addressService.create(userId, {
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : "Home",
      full_address: fullAddress,
      landmark: line2 ? line2.slice(0, 200) : (typeof body.landmark === "string" ? body.landmark.trim().slice(0, 200) : null),
      phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : null,
      city: typeof body.city === "string" && body.city.trim() ? body.city.trim().slice(0, 100) : "City",
      state: typeof body.state === "string" && body.state.trim() ? body.state.trim().slice(0, 100) : "State",
      country: typeof body.country === "string" && body.country.trim() ? body.country.trim().slice(0, 60) : "India",
      pincode: typeof body.pincode === "string" && body.pincode.trim() ? body.pincode.trim().slice(0, 10) : "000000",
      latitude: lat && !isNaN(lat) ? lat : null,
      longitude: lng && !isNaN(lng) ? lng : null,
      map_url: mapUrl,
      exact_location: exactLocation,
      ...(typeof body.is_default === "boolean" ? { is_default: body.is_default } : {}),
    } as never);
    return this.mapAddress(created, user?.name ?? "");
  },

  async updateMyAddress(userId: string, addressId: string, body: Record<string, unknown>) {
    const user = await userRepo.findById(userId, {});
    const input: Record<string, unknown> = {};
    if (typeof body.label === "string") input.label = body.label.trim().slice(0, 60);
    if (typeof body.line1 === "string" || typeof body.line2 === "string") {
      const line1 = typeof body.line1 === "string" ? body.line1.trim() : "";
      const line2 = typeof body.line2 === "string" ? body.line2.trim() : "";
      const combined = [line1, line2].filter(Boolean).join(", ");
      if (combined.length > 0) input.full_address = combined.slice(0, 400);
      if (line2) input.landmark = line2.slice(0, 200);
    } else if (typeof body.full_address === "string") {
      input.full_address = body.full_address.trim().slice(0, 400);
    }
    if (typeof body.landmark === "string" && !input.landmark) input.landmark = body.landmark.trim().slice(0, 200);
    if (typeof body.phone === "string") input.phone = body.phone.trim().slice(0, 20);
    if (typeof body.city === "string") input.city = body.city.trim().slice(0, 100);
    if (typeof body.state === "string") input.state = body.state.trim().slice(0, 100);
    if (typeof body.pincode === "string") input.pincode = body.pincode.trim().slice(0, 10);
    if (typeof body.country === "string") input.country = body.country.trim().slice(0, 60);
    if (typeof body.is_default === "boolean") input.is_default = body.is_default;
    if (body.latitude !== undefined) {
      const lat = typeof body.latitude === "number" ? body.latitude : (body.latitude ? parseFloat(String(body.latitude)) : null);
      input.latitude = lat && !isNaN(lat) ? lat : null;
    }
    if (body.longitude !== undefined) {
      const lng = typeof body.longitude === "number" ? body.longitude : (body.longitude ? parseFloat(String(body.longitude)) : null);
      input.longitude = lng && !isNaN(lng) ? lng : null;
    }
    if (body.map_url !== undefined) input.map_url = typeof body.map_url === "string" ? body.map_url.trim().slice(0, 500) : null;
    if (body.exact_location !== undefined) input.exact_location = typeof body.exact_location === "string" ? body.exact_location.trim().slice(0, 500) : null;
    const updated = await addressService.update(userId, addressId, input as never);
    return this.mapAddress(updated, user?.name ?? "");
  },

  async removeMyAddress(userId: string, addressId: string) {
    return addressService.remove(userId, addressId);
  },

  async setDefaultAddress(userId: string, addressId: string) {
    const user = await userRepo.findById(userId, {});
    const updated = await addressService.setDefault(userId, addressId);
    return this.mapAddress(updated, user?.name ?? "");
  },
};
