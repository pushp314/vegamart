import { z } from "zod";

import { createVendorSchema } from "./vendor.validators";

export const createOrderAliasSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
  coupon_code: z.string().trim().min(1).max(50).optional(),
  payment_method: z.enum(["upi", "card", "cod"]).default("upi"),
  delivery_slot: z.string().trim().max(60).optional(),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
});

export type CreateOrderAliasBody = z.infer<typeof createOrderAliasSchema>;

export const orderIdAliasParamsSchema = z.object({
  id: z.string().uuid("id must be a valid UUID."),
});

export type OrderIdAliasParams = z.infer<typeof orderIdAliasParamsSchema>;

export const ringBellSchema = z.object({
  address: z.string().trim().min(3).max(300),
  note: z.string().max(1000).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type RingBellBody = z.infer<typeof ringBellSchema>;

export const vendorRegisterSchema = createVendorSchema.extend({
  vendor_type: z.enum(["stationary", "roaming", "both"]).optional(),
  subscription_plan: z.string().trim().max(60).optional(),
});

export type VendorRegisterBody = z.infer<typeof vendorRegisterSchema>;

export const deliveryRegisterSchema = z.object({
  vehicle_type: z.string().trim().min(1).max(60),
  vehicle_number: z.string().trim().min(1).max(30),
  license_number: z.string().trim().max(60).optional(),
});

export type DeliveryRegisterBody = z.infer<typeof deliveryRegisterSchema>;

export const vendorKycSchema = z.object({
  document_type: z.string().trim().min(1).max(120),
  document_number: z.string().trim().min(1).max(120),
  fssai_license: z.string().trim().max(120).optional().nullable(),
  gst_number: z.string().trim().max(120).optional().nullable(),
});

export type VendorKycBody = z.infer<typeof vendorKycSchema>;

export const deliveryKycSchema = z.object({
  aadhaar_number: z.string().trim().min(1).max(120),
  pan_number: z.string().trim().max(120).optional().nullable(),
  driving_license: z.string().trim().max(120).optional().nullable(),
});

export type DeliveryKycBody = z.infer<typeof deliveryKycSchema>;

export const deliveryLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type DeliveryLocationBody = z.infer<typeof deliveryLocationSchema>;

export const deliveryOrderStatusSchema = z.object({
  status: z.enum([
    "accepted",
    "preparing",
    "packed",
    "ready_for_pickup",
    "picked_up",
    "out_for_delivery",
    "delivered",
  ]),
});

export type DeliveryOrderStatusBody = z.infer<typeof deliveryOrderStatusSchema>;

export const deliveredOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
});

export type DeliveredOtpBody = z.infer<typeof deliveredOtpSchema>;

export const recentlyViewedSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
});

export type RecentlyViewedBody = z.infer<typeof recentlyViewedSchema>;
