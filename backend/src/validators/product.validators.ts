import { z } from "zod";

import { MAX_PAGE_SIZE } from "../constants";

export const productIdParamsSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(160),
  category_id: z.string().uuid("category_id must be a valid UUID."),
  subcategory_id: z.string().uuid("subcategory_id must be a valid UUID.").optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  unit: z.string().trim().min(1).max(50),
  tag: z.string().trim().max(60).optional().nullable(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  is_vegetarian: z.boolean().optional().nullable(),
  stock: z.coerce.number().int().min(0).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const productImageSchema = z.object({
  url: z.string().url("url must be a valid URL.").max(500),
  alt_text: z.string().max(255).optional().nullable(),
  is_primary: z.boolean().optional(),
});

export const productImagesSchema = z.object({
  images: z.array(productImageSchema).min(1, "At least one image is required.").max(10),
});

export const setPrimaryImageSchema = z.object({
  image_id: z.string().uuid("image_id must be a valid UUID."),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  vendor_id: z.string().uuid("vendor_id must be a valid UUID.").optional(),
  category_id: z.string().uuid("category_id must be a valid UUID.").optional(),
  subcategory_id: z.string().uuid("subcategory_id must be a valid UUID.").optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  is_vegetarian: z.enum(["true", "false"]).optional(),
  is_available: z.enum(["true", "false"]).optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "rating", "newest", "popularity"])
    .optional(),
});

export const vendorProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  include_inactive: z.enum(["true", "false"]).optional(),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5.").max(5, "Rating must be between 1 and 5."),
  title: z.string().trim().max(140).optional().nullable(),
  comment: z.string().trim().max(5000).optional().nullable(),
  order_id: z.string().uuid("order_id must be a valid UUID.").optional().nullable(),
});

export type CreateProductBody = z.infer<typeof createProductSchema>;
export type UpdateProductBody = z.infer<typeof updateProductSchema>;
export type CreateReviewBody = z.infer<typeof createReviewSchema>;
