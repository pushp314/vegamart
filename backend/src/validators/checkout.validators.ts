import { z } from "zod";

const paymentMethodEnum = z.enum(["RAZORPAY", "COD"]);

export const checkoutPreviewSchema = z.object({
  coupon_code: z.string().trim().min(1).max(50).optional(),
}).strict();

export const placeOrderSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
  coupon_code: z.string().trim().min(1).max(50).optional(),
  payment_method: paymentMethodEnum.default("RAZORPAY"),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
}).strict();

export const createOrderFromCartSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
  coupon_code: z.string().trim().min(1).max(50).optional(),
  payment_method: z
    .enum(["upi", "card", "cod", "RAZORPAY", "COD"])
    .default("RAZORPAY")
    .transform((value) => (value === "cod" || value === "COD" ? "COD" : "RAZORPAY")),
  delivery_slot: z.string().trim().max(60).optional(),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1, "Cart is empty."),
}).strict();

export type CheckoutPreviewBody = z.infer<typeof checkoutPreviewSchema>;
export type PlaceOrderBody = z.infer<typeof placeOrderSchema>;
export type CreateOrderFromCartBody = z.infer<typeof createOrderFromCartSchema>;
