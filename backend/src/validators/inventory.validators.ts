import { z } from "zod";

export const inventoryParamsSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
}).strict();

export const setInventorySchema = z.object({
  quantity: z.coerce.number().int().min(0),
  low_stock_threshold: z.coerce.number().int().min(0).optional(),
  location: z.string().max(120).optional().nullable(),
}).strict();

export const adjustInventorySchema = z.object({
  delta: z.coerce.number().int(),
  reason: z.string().max(500).optional().nullable(),
}).strict();

export const bulkInventorySchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("product_id must be a valid UUID."),
        quantity: z.coerce.number().int().min(0),
        low_stock_threshold: z.coerce.number().int().min(0).optional(),
        location: z.string().max(120).optional().nullable(),
      })
    )
    .min(1, "At least one item is required.")
    .max(100),
}).strict();
