import { z } from "zod";

export const orderIdParamsSchema = z.object({
  order_id: z.string().trim().min(1, "order_id is required"),
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

export const updateDeliveryInstructionsSchema = z.object({
  instructions: z.array(z.string().trim().max(100)).max(10),
}).strict();

export const assignShopRiderSchema = z.object({
  rider_name: z.string().trim().min(2, "Rider name is required").max(100),
  rider_phone: z.string().trim().min(10, "Valid 10-digit phone number is required").max(15),
  vehicle_number: z.string().trim().max(30).optional().nullable(),
  estimated_minutes: z.coerce.number().min(1).max(240).optional().nullable(),
  notes: z.string().trim().max(200).optional().nullable(),
}).strict();

export const saveInHouseRiderSchema = z.object({
  name: z.string().trim().min(2, "Rider name is required").max(100),
  phone: z.string().trim().min(10, "Valid 10-digit phone number is required").max(15),
  vehicle_number: z.string().trim().max(30).optional().nullable(),
}).strict();

export const updatePickupPointSchema = z.object({
  pickup_point_name: z.string().trim().min(2, "Pickup point / entrance name is required").max(120),
  pickup_latitude: z.coerce.number().min(-90).max(90),
  pickup_longitude: z.coerce.number().min(-180).max(180),
  instructions: z.string().trim().max(300).optional().nullable(),
}).strict();

export type CancelOrderBody = z.infer<typeof cancelOrderSchema>;
export type RequestRefundBody = z.infer<typeof requestRefundSchema>;
export type TransitionOrderStatusBody = z.infer<typeof transitionOrderStatusSchema>;
export type UpdateDeliveryInstructionsBody = z.infer<typeof updateDeliveryInstructionsSchema>;
export type AssignShopRiderBody = z.infer<typeof assignShopRiderSchema>;
export type SaveInHouseRiderBody = z.infer<typeof saveInHouseRiderSchema>;
export type UpdatePickupPointBody = z.infer<typeof updatePickupPointSchema>;
