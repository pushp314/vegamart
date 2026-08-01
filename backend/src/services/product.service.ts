import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { vendorService } from "./vendor.service";
import * as productRepo from "../repositories/product.repository";
import { existsById as categoryExists } from "../repositories/category.repository";
import { cacheService } from "../database/cache";
import { ApiError, ForbiddenError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { uniqueSlug } from "../utils/slug";
import type { CreateProductBody, UpdateProductBody } from "../validators/product.validators";

function listCacheKey(query: Record<string, unknown>): string {
  const stable = Object.keys(query)
    .filter((k) => query[k] !== undefined && query[k] !== "")
    .sort()
    .map((k) => `${k}=${String(query[k])}`)
    .join("&");
  return `list:${stable || "all"}`;
}

export const productService = {
  async ensureOwnedProduct(productId: string, userId: string): Promise<productRepo.ProductRow> {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Product not found.", { code: "NOT_FOUND" });
    }
    const vendor = await vendorService.getMyVendor(userId);
    if (product.vendor_id !== vendor.id) {
      throw new ForbiddenError("You do not own this product.");
    }
    return product;
  },

  async create(userId: string, input: CreateProductBody, req: Request): Promise<productRepo.ProductRow> {
    const vendor = await vendorService.getMyVendor(userId);

    if (!(await categoryExists(input.category_id))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Category does not exist.", { code: "INVALID_CATEGORY" });
    }

    const existingSlugs = await productRepo.listSlugs(vendor.id);
    const slug = uniqueSlug(input.name, existingSlugs);

    const product = await productRepo.createProduct({
      vendor_id: vendor.id,
      category_id: input.category_id,
      subcategory_id: input.subcategory_id ?? null,
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      price: input.price,
      mrp: input.mrp,
      unit: input.unit.trim(),
      tag: input.tag ?? null,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      is_vegetarian: input.is_vegetarian ?? null,
      stock: input.stock ?? 0,
      is_available: input.stock !== undefined ? input.stock > 0 : true,
    });

    await cacheService.invalidateNamespace("product");

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PRODUCT_CREATED, entityType: "product", entityId: product.id, newValues: { name: product.name, slug, price: product.price.toFixed(2) } },
      req
    );

    return product;
  },

  async update(userId: string, productId: string, input: UpdateProductBody, req: Request): Promise<productRepo.ProductRow> {
    const product = await this.ensureOwnedProduct(productId, userId);

    if (input.category_id && !(await categoryExists(input.category_id))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Category does not exist.", { code: "INVALID_CATEGORY" });
    }

    if (input.name && input.name.trim() !== product.name) {
      const existingSlugs = await productRepo.listSlugs(product.vendor_id, product.id);
      const slug = uniqueSlug(input.name.trim(), existingSlugs);
      await productRepo.updateProduct(product.id, { name: input.name.trim(), slug });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.category_id !== undefined) data.category_id = input.category_id;
    if (input.subcategory_id !== undefined) data.subcategory_id = input.subcategory_id;
    if (input.description !== undefined) data.description = input.description || null;
    if (input.price !== undefined) data.price = input.price;
    if (input.mrp !== undefined) data.mrp = input.mrp;
    if (input.unit !== undefined) data.unit = input.unit.trim();
    if (input.tag !== undefined) data.tag = input.tag || null;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.is_featured !== undefined) data.is_featured = input.is_featured;
    if (input.is_vegetarian !== undefined) data.is_vegetarian = input.is_vegetarian;

    if (input.stock !== undefined) {
      data.stock = input.stock;
      data.is_available = input.stock > 0;
    }

    if (Object.keys(data).length > 0) {
      await productRepo.updateProduct(product.id, data as never);
    }

    const updated = await productRepo.findById(product.id);
    await cacheService.invalidateNamespace("product");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PRODUCT_UPDATED, entityType: "product", entityId: product.id, newValues: data },
      req
    );

    return updated!;
  },

  async remove(userId: string, productId: string, req: Request): Promise<void> {
    await this.ensureOwnedProduct(productId, userId);
    await productRepo.softDelete(productId);
    await cacheService.invalidateNamespace("product");
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PRODUCT_DELETED, entityType: "product", entityId: productId },
      req
    );
  },

  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    vendor_id?: string;
    category_id?: string;
    subcategory_id?: string;
    min_price?: number;
    max_price?: number;
    is_vegetarian?: string;
    is_available?: string;
    tag?: string;
    sort?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));

    const cacheable = !query.q && page <= 5;
    const key = listCacheKey({ ...query, page, per_page: perPage });
    const load = () =>
      productRepo.listProducts(
        {
          q: query.q,
          vendorId: query.vendor_id,
          categoryId: query.category_id,
          subcategoryId: query.subcategory_id,
          minPrice: query.min_price,
          maxPrice: query.max_price,
          isVegetarian: query.is_vegetarian === "true" ? true : query.is_vegetarian === "false" ? false : undefined,
          isAvailable: query.is_available === "true" ? true : query.is_available === "false" ? false : undefined,
          tag: query.tag,
          sort: query.sort,
        },
        (page - 1) * perPage,
        perPage
      );

    if (!cacheable) {
      const { rows, total } = await load();
      return { rows, total, page, perPage };
    }

    return cacheService.remember<{ rows: productRepo.ProductRow[]; total: number }>("product", key, async () => {
      const { rows, total } = await load();
      return { rows, total };
    }).then((cached) => ({ rows: cached?.rows ?? [], total: cached?.total ?? 0, page, perPage }));
  },

  async getById(productId: string, includeInactive = false): Promise<productRepo.ProductRow> {
    if (includeInactive) {
      return this.getByIdUncached(productId, true);
    }
    const product = await cacheService.remember<productRepo.ProductRow>(
      "product",
      `detail:${productId}`,
      () => this.getByIdUncached(productId, false)
    );
    return product as productRepo.ProductRow;
  },

  async getByIdUncached(productId: string, includeInactive: boolean): Promise<productRepo.ProductRow> {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Product not found.", { code: "NOT_FOUND" });
    }
    if (!includeInactive && (!product.is_active || !product.is_available)) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Product not found.", { code: "NOT_FOUND" });
    }
    return product;
  },

  async listMyProducts(userId: string, query: { page?: number; per_page?: number; q?: string; include_inactive?: string }) {
    const vendor = await vendorService.getMyVendor(userId);
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const includeInactive = query.include_inactive === "true";
    const { rows, total } = await productRepo.listByVendor(
      vendor.id,
      includeInactive,
      query.q,
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async addImages(userId: string, productId: string, images: Array<{ url: string; alt_text?: string | null; is_primary?: boolean }>, req: Request): Promise<productRepo.ProductRow> {
    await this.ensureOwnedProduct(productId, userId);
    for (const image of images) {
      await productRepo.addImage(productId, image);
    }
    await cacheService.invalidateEntity("product", productId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.IMAGE_ADDED, entityType: "product", entityId: productId, newValues: { count: images.length } },
      req
    );
    const product = await productRepo.findById(productId);
    return product!;
  },

  async removeImage(userId: string, productId: string, imageId: string, req: Request): Promise<void> {
    await this.ensureOwnedProduct(productId, userId);
    const removed = await productRepo.removeImage(productId, imageId);
    if (!removed) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Image not found.", { code: "NOT_FOUND" });
    }
    await cacheService.invalidateEntity("product", productId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.IMAGE_REMOVED, entityType: "product", entityId: productId, newValues: { image_id: imageId } },
      req
    );
  },

  async setPrimaryImage(userId: string, productId: string, imageId: string, req: Request): Promise<void> {
    await this.ensureOwnedProduct(productId, userId);
    const ok = await productRepo.setPrimaryImage(productId, imageId);
    if (!ok) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Image not found.", { code: "NOT_FOUND" });
    }
    await cacheService.invalidateEntity("product", productId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.IMAGE_REMOVED, entityType: "product", entityId: productId, newValues: { primary_image_id: imageId } },
      req
    );
  },
};
