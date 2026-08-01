import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { productService } from "./product.service";
import { vendorService } from "./vendor.service";
import { updateProduct as updateProductRepo } from "../repositories/product.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
import { ApiError, ValidationError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export interface InventoryAdjustment {
  product_id: string;
  quantity: number;
  low_stock_threshold?: number;
  location?: string | null;
}

export const inventoryService = {
  async ensureOwnedProduct(productId: string, userId: string): Promise<string> {
    const product = await productService.ensureOwnedProduct(productId, userId);
    return product.id;
  },

  async getByProductId(productId: string, userId: string) {
    await this.ensureOwnedProduct(productId, userId);
    const inventory = await inventoryRepo.findByProductId(productId);
    if (!inventory) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Inventory not found for this product.", { code: "NOT_FOUND" });
    }
    return inventory;
  },

  async set(productId: string, userId: string, input: { quantity: number; low_stock_threshold?: number; location?: string | null }, req: Request) {
    const product = await productService.ensureOwnedProduct(productId, userId);
    if (input.quantity < 0) {
      throw new ValidationError({ quantity: "Quantity cannot be negative." });
    }

    const inventory = await inventoryRepo.upsertInventory({
      product_id: productId,
      quantity: input.quantity,
      low_stock_threshold: input.low_stock_threshold,
      location: input.location,
      updated_by: userId,
    });

    await syncProductAvailability(product.id, input.quantity);

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.INVENTORY_UPDATED, entityType: "inventory", entityId: inventory.id, newValues: { product_id: productId, quantity: input.quantity } },
      req
    );

    return inventory;
  },

  async adjust(productId: string, userId: string, delta: number, reason: string | undefined, req: Request) {
    const product = await productService.ensureOwnedProduct(productId, userId);
    const current = await inventoryRepo.findByProductId(productId);
    if (!current) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Inventory not found for this product.", { code: "NOT_FOUND" });
    }

    const nextQuantity = Math.max(0, current.quantity + delta);
    const inventory = await inventoryRepo.updateInventory(productId, {
      quantity: nextQuantity,
      updated_by: userId,
    });

    await syncProductAvailability(product.id, nextQuantity);

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.INVENTORY_UPDATED, entityType: "inventory", entityId: inventory.id, newValues: { product_id: productId, delta, reason: reason ?? null, quantity: nextQuantity } },
      req
    );

    return inventory;
  },

  async bulkSet(userId: string, items: InventoryAdjustment[], req: Request) {
    const vendor = await vendorService.getMyVendor(userId);
    const results = [];

    for (const item of items) {
      const product = await productService.ensureOwnedProduct(item.product_id, userId);
      if (item.quantity < 0) {
        throw new ValidationError({ [item.product_id]: "Quantity cannot be negative." });
      }
      const inventory = await inventoryRepo.upsertInventory({
        product_id: item.product_id,
        quantity: item.quantity,
        low_stock_threshold: item.low_stock_threshold,
        location: item.location,
        updated_by: userId,
      });
      await syncProductAvailability(product.id, item.quantity);
      results.push(inventory);
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.INVENTORY_UPDATED, entityType: "inventory", entityId: vendor.id, newValues: { count: items.length } },
      req
    );

    return results;
  },

  async listForVendor(userId: string) {
    const vendor = await vendorService.getMyVendor(userId);
    return inventoryRepo.listByVendor(vendor.id);
  },
};

async function syncProductAvailability(productId: string, quantity: number): Promise<void> {
  const isAvailable = quantity > 0;
  await updateProductRepo(productId, {
    stock: quantity,
    is_available: isAvailable,
  });
}
