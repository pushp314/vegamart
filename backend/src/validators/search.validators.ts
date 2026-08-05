import { z } from "zod";

import { MAX_PAGE_SIZE } from "../constants";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required.").max(160),
  type: z.enum(["products", "vendors", "all"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
}).strict();

export const autocompleteQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required.").max(160),
  limit: z.coerce.number().int().min(1).max(20).optional(),
}).strict();

export const nearbyProductsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.5).max(50).optional(),
  category_id: z.string().uuid("category_id must be a valid UUID.").optional(),
  q: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
}).strict();
