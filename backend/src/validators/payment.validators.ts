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

export type VerifyPaymentBody = z.infer<typeof verifyPaymentSchema>;
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;
