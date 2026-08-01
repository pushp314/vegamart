import { z } from "zod";

import { MAX_PAGE_SIZE } from "../constants";

export const categoryIdParamsSchema = z.object({
  category_id: z.string().uuid("category_id must be a valid UUID."),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  parent_id: z.string().uuid("parent_id must be a valid UUID.").optional().nullable(),
  icon: z.string().max(500).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  image_url: z.string().url("image_url must be a valid URL.").max(500).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  include_inactive: z.enum(["true", "false"]).optional(),
  tree: z.enum(["true", "false"]).optional(),
});

export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
