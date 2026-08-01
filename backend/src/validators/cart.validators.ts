import { z } from "zod";

export const cartItemIdParamsSchema = z.object({
  item_id: z.string().uuid("item_id must be a valid UUID."),
});

export const addCartItemSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(50, "Quantity cannot exceed 50."),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(50, "Quantity cannot exceed 50."),
});

export type AddCartItemBody = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemSchema>;
