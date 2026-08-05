import { z } from "zod";

export const wishlistProductParamsSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
}).strict();

export const addWishlistItemSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
}).strict();

export type AddWishlistItemBody = z.infer<typeof addWishlistItemSchema>;
