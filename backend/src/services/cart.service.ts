import type { Request } from "express";
import { Prisma } from "@prisma/client";

import { AUDIT_ACTIONS } from "../constants/auth";
import { SETTING_KEYS } from "../constants/settings";
import { auditService } from "./audit.service";
import * as cartRepo from "../repositories/cart.repository";
import { findByProductId } from "../repositories/inventory.repository";
import { findById as findProductById } from "../repositories/product.repository";
import { settingsService } from "./settings.service";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const CART_MAX_QUANTITY = 50;

export const cartService = {
  async getMyCart(userId: string): Promise<cartRepo.CartRow> {
    return cartRepo.getOrCreate(userId);
  },

  async addItem(
    userId: string,
    input: { product_id: string; quantity: number; selected_unit?: string },
    req: Request
  ): Promise<cartRepo.CartRow> {
    const product = await findProductById(input.product_id);
    if (!product || !product.is_active || !product.is_available) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Product not found or unavailable.", { code: "NOT_FOUND" });
    }
    if (product.vendor?.is_open === false || product.vendor?.status !== "APPROVED") {
      throw new ApiError(HttpStatus.NOT_FOUND, "Product is unavailable because the vendor is offline.", { code: "NOT_FOUND" });
    }

    const selectedUnit = input.selected_unit?.trim() || product.unit;
    let unitPrice = product.price.toNumber();
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const variant = product.variants.find(
        (v: { unit?: string; price?: number; mrp?: number }) =>
          v?.unit === selectedUnit
      );
      if (variant && typeof variant.price === "number") {
        unitPrice = variant.price;
      }
    }

    const cart = await cartRepo.getOrCreate(userId);

    const settings = await settingsService.getAllSettings();
    const multiStoreEnabled = settings[SETTING_KEYS.MULTI_STORE_CHECKOUT_ENABLED] === true;
    const currentVendorIds = Array.from(
      new Set(cart.items.map((item) => item.product.vendor_id).filter(Boolean))
    );
    if (
      !multiStoreEnabled &&
      currentVendorIds.length > 0 &&
      product.vendor_id &&
      !currentVendorIds.includes(product.vendor_id)
    ) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Your cart already contains items from another store. Complete or clear that order before adding items from a new store.", {
        code: "MULTI_STORE_NOT_ALLOWED",
      });
    }

    const existing = cart.items.find(
      (item) => item.product_id === input.product_id && item.selected_unit === selectedUnit
    );
    const targetQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (targetQuantity > CART_MAX_QUANTITY) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Quantity cannot exceed ${CART_MAX_QUANTITY} per product.`, {
        code: "QUANTITY_LIMIT",
      });
    }

    if (product.stock <= 0) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Product is sold out.", {
        code: "SOLD_OUT",
      });
    }
    if (product.stock < targetQuantity) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Insufficient stock for this product.", {
        code: "INSUFFICIENT_STOCK",
      });
    }

    const inventory = await findByProductId(input.product_id);
    if (inventory) {
      const available = inventory.quantity - inventory.reserved;
      if (available <= 0) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Product is sold out.", {
          code: "SOLD_OUT",
        });
      }
      if (available < targetQuantity) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Insufficient stock for this product.", {
          code: "INSUFFICIENT_STOCK",
        });
      }
    }

    const updated = await cartRepo.addItem(cart.id, input.product_id, input.quantity, new Prisma.Decimal(unitPrice), selectedUnit);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.CART_ITEM_ADDED, entityType: "cart_item", entityId: input.product_id, newValues: { product_id: input.product_id, quantity: input.quantity, selected_unit: selectedUnit } },
      req
    );
    return updated;
  },

  async updateItem(userId: string, itemId: string, input: { quantity: number }, req: Request): Promise<cartRepo.CartRow> {
    const cart = await cartRepo.getOrCreate(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundError("Cart item not found.");
    }

    if (input.quantity > CART_MAX_QUANTITY) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Quantity cannot exceed ${CART_MAX_QUANTITY} per product.`, {
        code: "QUANTITY_LIMIT",
      });
    }

    const product = await findProductById(item.product_id);
    if (product) {
      if (product.stock <= 0) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Product is sold out.", {
          code: "SOLD_OUT",
        });
      }
      if (product.stock < input.quantity) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Insufficient stock for this product.", {
          code: "INSUFFICIENT_STOCK",
        });
      }
    }

    const inventory = await findByProductId(item.product_id);
    if (inventory) {
      const available = inventory.quantity - inventory.reserved;
      if (available <= 0) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Product is sold out.", {
          code: "SOLD_OUT",
        });
      }
      if (available < input.quantity) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Insufficient stock for this product.", {
          code: "INSUFFICIENT_STOCK",
        });
      }
    }

    const updated = await cartRepo.setItemQuantity(cart.id, itemId, input.quantity);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.CART_ITEM_UPDATED, entityType: "cart_item", entityId: itemId, oldValues: { quantity: item.quantity }, newValues: { quantity: input.quantity } },
      req
    );
    return updated!;
  },

  async removeItem(userId: string, itemId: string, req: Request): Promise<cartRepo.CartRow> {
    const cart = await cartRepo.getOrCreate(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundError("Cart item not found.");
    }
    const removed = await cartRepo.removeItem(cart.id, itemId);
    if (!removed) {
      throw new NotFoundError("Cart item not found.");
    }
    const updated = await cartRepo.findByUserId(userId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.CART_ITEM_REMOVED, entityType: "cart_item", entityId: itemId, newValues: { product_id: item.product_id } },
      req
    );
    return updated!;
  },

  async clear(userId: string, req: Request): Promise<void> {
    const cart = await cartRepo.getOrCreate(userId);
    await cartRepo.clear(cart.id);
    await auditService.record({ userId, action: AUDIT_ACTIONS.CART_CLEARED, entityType: "cart", entityId: cart.id }, req);
  },
};
