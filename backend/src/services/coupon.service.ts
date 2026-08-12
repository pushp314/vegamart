import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as couponRepo from "../repositories/coupon.repository";
import type { CartRow } from "../repositories/cart.repository";
import prisma from "../database/prisma";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import type { CreateCouponBody, UpdateCouponBody } from "../validators/coupon.validators";

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export const couponService = {
  async listAdmin(query: { page?: number; per_page?: number; is_active?: string; q?: string; type?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await couponRepo.listCoupons(
      {
        isActive: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined,
        q: query.q,
        type: query.type,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async listActive(now: Date): Promise<couponRepo.CouponRow[]> {
    return couponRepo.listActiveBetween(new Date(0), now);
  },

  async listVendor(vendorId: string, query: { page?: number; per_page?: number; is_active?: string; q?: string; type?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await couponRepo.listByVendor(
      vendorId,
      {
        isActive: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined,
        q: query.q,
        type: query.type,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async assertVendorOwns(vendorId: string, couponId: string): Promise<couponRepo.CouponRow> {
    const existing = await couponRepo.findById(couponId);
    if (!existing || existing.created_by_vendor_id !== vendorId) {
      throw new NotFoundError("Coupon not found.");
    }
    return existing;
  },

  async createForVendor(vendorId: string, input: CreateCouponBody, req: Request): Promise<couponRepo.CouponRow> {
    const existing = await couponRepo.findByCode(input.code.toUpperCase());
    if (existing) {
      throw new ApiError(HttpStatus.CONFLICT, "Coupon code already exists.", { code: "CONFLICT" });
    }
    const coupon = await couponRepo.createCoupon({
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value,
      max_discount: input.max_discount ?? null,
      min_order_value: input.min_order_value ?? null,
      usage_limit: input.usage_limit ?? 0,
      per_user_limit: input.per_user_limit ?? 1,
      valid_from: input.valid_from,
      valid_until: input.valid_until,
      is_active: input.is_active ?? true,
      applies_to_vendor_ids: [vendorId],
      applies_to_product_ids: input.applies_to_product_ids ?? null,
      applies_to_category_ids: input.applies_to_category_ids ?? null,
      created_by_vendor_id: vendorId,
    });
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.COUPON_CREATED, entityType: "coupon", entityId: coupon.id, newValues: { code: coupon.code, type: coupon.type, value: coupon.value.toNumber(), created_by_vendor_id: vendorId } },
      req
    );
    return coupon;
  },

  async updateForVendor(vendorId: string, id: string, input: UpdateCouponBody, req: Request): Promise<couponRepo.CouponRow> {
    const existing = await this.assertVendorOwns(vendorId, id);
    if (input.code && input.code.toUpperCase() !== existing.code) {
      const dup = await couponRepo.findByCode(input.code.toUpperCase());
      if (dup) {
        throw new ApiError(HttpStatus.CONFLICT, "Coupon code already exists.", { code: "CONFLICT" });
      }
    }

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code.toUpperCase();
    if (input.type !== undefined) data.type = input.type;
    if (input.value !== undefined) data.value = input.value;
    if (input.max_discount !== undefined) data.max_discount = input.max_discount;
    if (input.min_order_value !== undefined) data.min_order_value = input.min_order_value;
    if (input.usage_limit !== undefined) data.usage_limit = input.usage_limit;
    if (input.per_user_limit !== undefined) data.per_user_limit = input.per_user_limit;
    if (input.valid_from !== undefined) data.valid_from = input.valid_from;
    if (input.valid_until !== undefined) data.valid_until = input.valid_until;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.applies_to_product_ids !== undefined) data.applies_to_product_ids = input.applies_to_product_ids?.length ? input.applies_to_product_ids.join(",") : null;
    if (input.applies_to_category_ids !== undefined) data.applies_to_category_ids = input.applies_to_category_ids?.length ? input.applies_to_category_ids.join(",") : null;

    const updated = await couponRepo.updateCoupon(id, data as never);
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.COUPON_UPDATED, entityType: "coupon", entityId: id, oldValues: { code: existing.code }, newValues: data },
      req
    );
    return updated;
  },

  async removeForVendor(vendorId: string, id: string, req: Request): Promise<void> {
    await this.assertVendorOwns(vendorId, id);
    await couponRepo.softDelete(id);
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.COUPON_DELETED, entityType: "coupon", entityId: id, oldValues: { id } },
      req
    );
  },

  async create(input: CreateCouponBody, req: Request): Promise<couponRepo.CouponRow> {
    const existing = await couponRepo.findByCode(input.code.toUpperCase());
    if (existing) {
      throw new ApiError(HttpStatus.CONFLICT, "Coupon code already exists.", { code: "CONFLICT" });
    }
    const coupon = await couponRepo.createCoupon({
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value,
      max_discount: input.max_discount ?? null,
      min_order_value: input.min_order_value ?? null,
      usage_limit: input.usage_limit ?? 0,
      per_user_limit: input.per_user_limit ?? 1,
      valid_from: input.valid_from,
      valid_until: input.valid_until,
      is_active: input.is_active ?? true,
      applies_to_vendor_ids: input.applies_to_vendor_ids ?? null,
      applies_to_product_ids: input.applies_to_product_ids ?? null,
      applies_to_category_ids: input.applies_to_category_ids ?? null,
    });
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.COUPON_CREATED, entityType: "coupon", entityId: coupon.id, newValues: { code: coupon.code, type: coupon.type, value: coupon.value.toNumber() } },
      req
    );
    return coupon;
  },

  async update(id: string, input: UpdateCouponBody, req: Request): Promise<couponRepo.CouponRow> {
    const existing = await couponRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Coupon not found.");
    }
    if (input.code && input.code.toUpperCase() !== existing.code) {
      const dup = await couponRepo.findByCode(input.code.toUpperCase());
      if (dup) {
        throw new ApiError(HttpStatus.CONFLICT, "Coupon code already exists.", { code: "CONFLICT" });
      }
    }

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code.toUpperCase();
    if (input.type !== undefined) data.type = input.type;
    if (input.value !== undefined) data.value = input.value;
    if (input.max_discount !== undefined) data.max_discount = input.max_discount;
    if (input.min_order_value !== undefined) data.min_order_value = input.min_order_value;
    if (input.usage_limit !== undefined) data.usage_limit = input.usage_limit;
    if (input.per_user_limit !== undefined) data.per_user_limit = input.per_user_limit;
    if (input.valid_from !== undefined) data.valid_from = input.valid_from;
    if (input.valid_until !== undefined) data.valid_until = input.valid_until;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.applies_to_vendor_ids !== undefined) data.applies_to_vendor_ids = input.applies_to_vendor_ids?.length ? input.applies_to_vendor_ids.join(",") : null;
    if (input.applies_to_product_ids !== undefined) data.applies_to_product_ids = input.applies_to_product_ids?.length ? input.applies_to_product_ids.join(",") : null;
    if (input.applies_to_category_ids !== undefined) data.applies_to_category_ids = input.applies_to_category_ids?.length ? input.applies_to_category_ids.join(",") : null;

    const updated = await couponRepo.updateCoupon(id, data as never);
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.COUPON_UPDATED, entityType: "coupon", entityId: id, oldValues: { code: existing.code }, newValues: data },
      req
    );
    return updated;
  },

  async remove(id: string, req: Request): Promise<void> {
    const existing = await couponRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Coupon not found.");
    }
    await couponRepo.softDelete(id);
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.COUPON_DELETED, entityType: "coupon", entityId: id, oldValues: { code: existing.code } },
      req
    );
  },

  async validateForCart(code: string, cart: CartRow, userId: string): Promise<{ coupon: couponRepo.CouponRow; discount: number }> {
    const coupon = await this.validate(code, cart, userId);
    return coupon;
  },

  async validateForItems(
    code: string,
    items: Array<{ product_id: string; quantity: number }>,
    userId: string
  ): Promise<{ coupon: couponRepo.CouponRow; discount: number }> {
    const ids = [...new Set(items.map((i) => i.product_id))];
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, deleted_at: null },
      select: {
        id: true,
        name: true,
        slug: true,
        unit: true,
        price: true,
        mrp: true,
        is_active: true,
        is_available: true,
        stock: true,
        vendor_id: true,
        category_id: true,
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const now = new Date();
    const cart: CartRow = {
      id: "",
      user_id: userId,
      created_at: now,
      updated_at: now,
      items: items.flatMap((i) => {
        const product = byId.get(i.product_id);
        if (!product) {
          return [];
        }
        return [
          {
            id: "",
            product_id: product.id,
            quantity: Math.max(1, i.quantity),
            selected_unit: null,
            price_snapshot: product.price,
            created_at: now,
            updated_at: now,
            product: {
              ...product,
              images: [],
            },
          },
        ];
      }),
    };
    return this.validate(code, cart, userId);
  },

  async validate(code: string, cart: CartRow, userId: string): Promise<{ coupon: couponRepo.CouponRow; discount: number }> {
    const coupon = await couponRepo.findByCode(code.toUpperCase());
    const now = new Date();

    if (!coupon || !coupon.is_active) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid or inactive coupon code.", { code: "INVALID_COUPON" });
    }
    if (now < coupon.valid_from || now > coupon.valid_until) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon is not valid at this time.", { code: "COUPON_EXPIRED" });
    }
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon usage limit has been reached.", { code: "COUPON_EXHAUSTED" });
    }
    if (coupon.per_user_limit > 0) {
      const usedByUser = await couponRepo.countUserUsages(coupon.id, userId);
      if (usedByUser >= coupon.per_user_limit) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "You have already used this coupon.", { code: "COUPON_PER_USER_LIMIT" });
      }
    }

    const { subtotal, vendorIds, productIds, categoryIds } = this.cartContext(cart);

    if (coupon.min_order_value !== null && subtotal < coupon.min_order_value.toNumber()) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Minimum order value for this coupon is ₹${coupon.min_order_value.toFixed(2)}.`, { code: "MIN_ORDER_VALUE" });
    }

    const vendorList = parseCsv(coupon.applies_to_vendor_ids);
    if (vendorList.length > 0 && !vendorIds.some((v) => vendorList.includes(v))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon is not applicable to the items in your cart.", { code: "COUPON_NOT_APPLICABLE" });
    }

    const productList = parseCsv(coupon.applies_to_product_ids);
    if (productList.length > 0 && !productIds.some((p) => productList.includes(p))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon is not applicable to the items in your cart.", { code: "COUPON_NOT_APPLICABLE" });
    }

    const categoryList = parseCsv(coupon.applies_to_category_ids);
    if (categoryList.length > 0 && !categoryIds.some((c) => categoryList.includes(c))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon is not applicable to the items in your cart.", { code: "COUPON_NOT_APPLICABLE" });
    }

    const discount = this.computeDiscount(coupon, subtotal, cart);
    return { coupon, discount };
  },

  cartContext(cart: CartRow): { subtotal: number; vendorIds: string[]; productIds: string[]; categoryIds: string[] } {
    let subtotal = 0;
    const vendorIds = new Set<string>();
    const productIds = new Set<string>();
    const categoryIds = new Set<string>();
    for (const item of cart.items) {
      const price = item.price_snapshot.toNumber();
      subtotal += price * item.quantity;
      vendorIds.add(item.product.vendor_id);
      productIds.add(item.product.id);
      categoryIds.add(item.product.category_id);
    }
    return { subtotal, vendorIds: [...vendorIds], productIds: [...productIds], categoryIds: [...categoryIds] };
  },

  computeDiscount(coupon: couponRepo.CouponRow, subtotal: number, _cart: CartRow): number {
    if (coupon.type === "FREE_DELIVERY") {
      return 0;
    }
    let discount: number;
    if (coupon.type === "PERCENTAGE") {
      discount = (subtotal * coupon.value.toNumber()) / 100;
    } else {
      discount = coupon.value.toNumber();
    }
    if (coupon.max_discount !== null) {
      discount = Math.min(discount, coupon.max_discount.toNumber());
    }
    return Math.max(0, Math.round(discount * 100) / 100);
  },
};
