import { z } from "zod";

const paymentMethodEnum = z.enum(["RAZORPAY", "COD"]);

export const checkoutPreviewSchema = z.object({
  coupon_code: z.string().trim().min(1).max(50).optional(),
});

export const placeOrderSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
  coupon_code: z.string().trim().min(1).max(50).optional(),
  payment_method: paymentMethodEnum.default("RAZORPAY"),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
});

export type CheckoutPreviewBody = z.infer<typeof checkoutPreviewSchema>;
export type PlaceOrderBody = z.infer<typeof placeOrderSchema>;
