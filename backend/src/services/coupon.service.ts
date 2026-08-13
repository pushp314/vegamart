import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as couponRepo from "../repositories/coupon.repository";
import type { CartRow } from "../repositories/cart.repository";
import { cartFromItems } from "../utils/cart";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import type { CreateCouponBody, UpdateCouponBody } from "../validators/coupon.validators";

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface CouponValidationResult {
  coupon: couponRepo.CouponRow;
  /** Total discount across all eligible items (authoritative cart-level discount). */
  discount: number;
  /** Subtotal of only the items this coupon can be applied to. */
  eligible_subtotal: number;
  /** Per-vendor eligible discount; only vendors with eligible items are present. */
  group_discounts: Record<string, number>;
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

  async validateForCart(
    code: string,
    cart: CartRow,
    userId: string
  ): Promise<CouponValidationResult> {
    return this.validate(code, cart, userId);
  },

  async validateForItems(
    code: string,
    items: Array<{ product_id: string; quantity: number }>,
    userId: string
  ): Promise<CouponValidationResult> {
    const cart = await cartFromItems(userId, items);
    return this.validate(code, cart, userId);
  },

  async validate(code: string, cart: CartRow, userId: string): Promise<CouponValidationResult> {
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

    const { eligibleSubtotal, vendorSubtotals } = this.computeEligibility(coupon, cart);

    if (coupon.min_order_value !== null && eligibleSubtotal < coupon.min_order_value.toNumber()) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Minimum order value for this coupon is ₹${coupon.min_order_value.toFixed(2)}.`, { code: "MIN_ORDER_VALUE" });
    }

    const hasRestriction =
      parseCsv(coupon.applies_to_vendor_ids).length > 0 ||
      parseCsv(coupon.applies_to_product_ids).length > 0 ||
      parseCsv(coupon.applies_to_category_ids).length > 0;
    if (hasRestriction && eligibleSubtotal === 0) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Coupon is not applicable to the items in your cart.", { code: "COUPON_NOT_APPLICABLE" });
    }

    const discount = this.computeDiscount(coupon, eligibleSubtotal);
    const group_discounts = this.allocateDiscount(discount, vendorSubtotals);

    return { coupon, discount, eligible_subtotal: eligibleSubtotal, group_discounts };
  },

  /**
   * Authoritative eligibility context for a coupon against a cart: the subtotal of
   * ONLY the items the coupon can be applied to (vendor/product/category
   * restrictions are honoured), and the per-vendor breakdown of that eligible
   * subtotal. This is the single place eligibility is derived, so checkout always
   * discounts vendor orders against their own eligible items.
   */
  computeEligibility(coupon: couponRepo.CouponRow, cart: CartRow): {
    eligibleSubtotal: number;
    vendorSubtotals: Map<string, number>;
  } {
    const vendorList = parseCsv(coupon.applies_to_vendor_ids);
    const productList = parseCsv(coupon.applies_to_product_ids);
    const categoryList = parseCsv(coupon.applies_to_category_ids);

    const vendorSubtotals = new Map<string, number>();
    let eligibleSubtotal = 0;
    for (const item of cart.items) {
      if (vendorList.length > 0 && !vendorList.includes(item.product.vendor_id)) continue;
      if (productList.length > 0 && !productList.includes(item.product.id)) continue;
      if (categoryList.length > 0 && !categoryList.includes(item.product.category_id)) continue;
      const line = item.price_snapshot.toNumber() * item.quantity;
      eligibleSubtotal += line;
      vendorSubtotals.set(
        item.product.vendor_id,
        Math.round(((vendorSubtotals.get(item.product.vendor_id) ?? 0) + line) * 100) / 100
      );
    }
    return { eligibleSubtotal: Math.round(eligibleSubtotal * 100) / 100, vendorSubtotals };
  },

  /**
   * Distributes a cart-level discount across vendors proportionally to each
   * vendor's eligible subtotal. Vendors with no eligible items receive no share,
   * so a vendor-restricted coupon can never discount another vendor's order. The
   * allocated shares always sum back to `discount` (rounding is absorbed by the
   * vendor with the largest eligible subtotal).
   */
  allocateDiscount(discount: number, vendorSubtotals: Map<string, number>): Record<string, number> {
    const entries = [...vendorSubtotals.entries()];
    const totalEligible = entries.reduce((sum, [, sub]) => sum + sub, 0);
    if (totalEligible <= 0) return {};
    const shares: Array<[string, number]> = entries.map(([vendorId, sub]) => [
      vendorId,
      Math.round(((discount * sub) / totalEligible) * 100) / 100,
    ]);
    const allocated = shares.reduce((sum, [, d]) => sum + d, 0);
    const remainder = Math.round((discount - allocated) * 100) / 100;
    if (remainder !== 0 && shares.length > 0) {
      // Absorb the rounding remainder into the vendor with the largest eligible subtotal.
      let bestIndex = 0;
      let bestSubtotal = -1;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i] as [string, number];
        if (entry[1] > bestSubtotal) {
          bestSubtotal = entry[1];
          bestIndex = i;
        }
      }
      const target = shares[bestIndex] as [string, number];
      shares[bestIndex] = [target[0], Math.round((target[1] + remainder) * 100) / 100];
    }
    const result: Record<string, number> = {};
    for (const [vendorId, share] of shares) {
      if (share > 0) result[vendorId] = share;
    }
    return result;
  },

  computeDiscount(coupon: couponRepo.CouponRow, subtotal: number): number {
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
    // A FIXED (or oversized percentage) discount must never exceed the eligible
    // subtotal — the final payable amount can therefore never go negative.
    discount = Math.min(discount, subtotal);
    return Math.max(0, Math.round(discount * 100) / 100);
  },
};
