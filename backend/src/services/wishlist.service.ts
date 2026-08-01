import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as wishlistRepo from "../repositories/wishlist.repository";
import { findById as findProductById } from "../repositories/product.repository";
import { ConflictError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { ApiError } from "../utils/ApiError";

export const wishlistService = {
  async list(userId: string): Promise<wishlistRepo.WishlistRow[]> {
    return wishlistRepo.listByUser(userId);
  },

  async add(userId: string, productId: string, req: Request): Promise<wishlistRepo.WishlistRow> {
    const product = await findProductById(productId);
    if (!product || !product.is_active) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Product not found.", { code: "NOT_FOUND" });
    }
    const existing = await wishlistRepo.findByUserAndProduct(userId, productId);
    if (existing) {
      throw new ConflictError("Product is already in your wishlist.");
    }
    const item = await wishlistRepo.add(userId, productId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.WISHLIST_ITEM_ADDED, entityType: "wishlist_item", entityId: productId, newValues: { product_id: productId } },
      req
    );
    return item;
  },

  async remove(userId: string, productId: string, req: Request): Promise<void> {
    const removed = await wishlistRepo.remove(userId, productId);
    if (!removed) {
      throw new NotFoundError("Wishlist item not found.");
    }
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.WISHLIST_ITEM_REMOVED, entityType: "wishlist_item", entityId: productId, newValues: { product_id: productId } },
      req
    );
  },
};
