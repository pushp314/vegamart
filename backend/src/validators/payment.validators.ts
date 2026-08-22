import { z } from "zod";

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "razorpay_order_id is required.").max(64),
  razorpay_payment_id: z.string().min(1, "razorpay_payment_id is required.").max(64),
  razorpay_signature: z.string().min(1, "razorpay_signature is required.").max(255),
}).strict();

export const orderIdParamsSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID."),
}).strict();

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().max(255).optional(),
}).strict();

export const initiateCheckoutPaymentSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
  coupon_code: z.string().trim().min(1).max(50).optional(),
  payment_type: z.enum(["FULL", "ADVANCE"]).default("FULL").optional(),
  delivery_slot: z.string().trim().max(60).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        selected_unit: z.string().trim().min(1).max(50).optional(),
      })
    )
    .min(1, "Cart is empty."),
}).strict();

export const verifyAndCreateOrderSchema = z.object({
  razorpay_order_id: z.string().min(1, "razorpay_order_id is required.").max(64),
  razorpay_payment_id: z.string().min(1, "razorpay_payment_id is required.").max(64),
  razorpay_signature: z.string().min(1, "razorpay_signature is required.").max(255),
  checkout_payload: initiateCheckoutPaymentSchema,
}).strict();

export type VerifyPaymentBody = z.infer<typeof verifyPaymentSchema>;
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;
export type InitiateCheckoutPaymentBody = z.infer<typeof initiateCheckoutPaymentSchema>;
export type VerifyAndCreateOrderBody = z.infer<typeof verifyAndCreateOrderSchema>;
