import { z } from "zod";

export const orderIdParamsSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID."),
}).strict();

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().trim().max(40).optional(),
}).strict();

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(255).optional(),
}).strict();

export const transitionOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(500).optional(),
  otp_code: z.string().trim().length(6).optional(),
}).strict();

export const requestRefundSchema = z.object({
  reason: z.string().trim().min(5, "Reason is required and must be at least 5 characters.").max(500),
}).strict();

export type CancelOrderBody = z.infer<typeof cancelOrderSchema>;
export type RequestRefundBody = z.infer<typeof requestRefundSchema>;
export type TransitionOrderStatusBody = z.infer<typeof transitionOrderStatusSchema>;
