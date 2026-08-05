import { z } from "zod";
import { OtpPurpose } from "@prisma/client";

import { createVendorSchema } from "./vendor.validators";

export const createCmsOfferSchema = z.object({
  title: z.string().trim().min(2).max(200),
  sub: z.string().trim().max(2000).optional().nullable(),
  tag: z.string().trim().max(60).optional().nullable(),
  tone: z.string().trim().max(30).optional().nullable(),
}).strict();

export type CreateCmsOfferBody = z.infer<typeof createCmsOfferSchema>;

export const createCmsBannerSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  type: z.string().trim().max(40).optional().nullable(),
  link_url: z.string().trim().max(500).optional().nullable(),
  image_url: z.string().trim().url("image_url must be a valid URL.").max(500),
}).strict();

export type CreateCmsBannerBody = z.infer<typeof createCmsBannerSchema>;

export const createCmsFaqSchema = z.object({
  question: z.string().trim().min(2).max(300),
  answer: z.string().trim().min(2),
  sort_order: z.coerce.number().int().min(0).optional(),
}).strict();

export type CreateCmsFaqBody = z.infer<typeof createCmsFaqSchema>;

export const productIdAliasParamsSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
}).strict();

export const featureProductSchema = z.object({
  is_featured: z.coerce.boolean(),
}).strict();

export type FeatureProductBody = z.infer<typeof featureProductSchema>;

export const sendLoginOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  purpose: z.nativeEnum(OtpPurpose).optional(),
}).strict();

export type SendLoginOtpBody = z.infer<typeof sendLoginOtpSchema>;

export const verifyLoginOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
  purpose: z.nativeEnum(OtpPurpose).optional(),
}).strict();

export type VerifyLoginOtpBody = z.infer<typeof verifyLoginOtpSchema>;

export const createOrderAliasSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
  coupon_code: z.string().trim().min(1).max(50).optional(),
  payment_method: z.enum(["upi", "card", "cod"]).default("upi"),
  delivery_slot: z.string().trim().max(60).optional(),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("product_id must be a valid UUID."),
        quantity: z.coerce.number().int().min(1).max(50),
      })
    )
    .min(1)
    .max(100)
    .optional(),
}).strict();

export type CreateOrderAliasBody = z.infer<typeof createOrderAliasSchema>;

export const orderIdAliasParamsSchema = z.object({
  id: z.string().uuid("id must be a valid UUID."),
}).strict();

export type OrderIdAliasParams = z.infer<typeof orderIdAliasParamsSchema>;

export const ringBellSchema = z.object({
  address: z.string().trim().min(3).max(300),
  note: z.string().max(1000).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
}).strict();

export type RingBellBody = z.infer<typeof ringBellSchema>;

export const vendorRegisterSchema = createVendorSchema.extend({
  vendor_type: z
    .enum(["stationary", "roaming", "both", "shop"])
    .optional()
    .transform((value) => (value === "shop" ? "stationary" : value)),
  subscription_plan: z.string().trim().max(60).optional(),
});

export type VendorRegisterBody = z.infer<typeof vendorRegisterSchema>;

export const deliveryRegisterSchema = z.object({
  vehicle_type: z.string().trim().min(1).max(60),
  vehicle_number: z.string().trim().min(1).max(30),
  license_number: z.string().trim().max(60).optional(),
}).strict();

export type DeliveryRegisterBody = z.infer<typeof deliveryRegisterSchema>;

export const deliveryApplySchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone must be 10-15 digits, optionally prefixed with +.")
    .optional()
    .or(z.literal("")),
  vehicle_type: z.string().trim().min(1).max(60),
  vehicle_number: z.string().trim().max(30).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional(),
}).strict();

export type DeliveryApplyBody = z.infer<typeof deliveryApplySchema>;

export const vendorKycSchema = z.object({
  document_type: z.string().trim().min(1).max(120),
  document_number: z.string().trim().min(1).max(120),
  fssai_license: z.string().trim().max(120).optional().nullable(),
  gst_number: z.string().trim().max(120).optional().nullable(),
}).strict();

export type VendorKycBody = z.infer<typeof vendorKycSchema>;

export const deliveryKycSchema = z.object({
  aadhaar_number: z.string().trim().min(1).max(120),
  pan_number: z.string().trim().max(120).optional().nullable(),
  driving_license: z.string().trim().max(120).optional().nullable(),
}).strict();

export type DeliveryKycBody = z.infer<typeof deliveryKycSchema>;

export const deliveryLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
}).strict();

export type DeliveryLocationBody = z.infer<typeof deliveryLocationSchema>;

export const deliveryAcceptSchema = z.object({
  eta_minutes: z.number().int().min(1).max(300),
}).strict();

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
}).strict();

export type DeliveryOrderStatusBody = z.infer<typeof deliveryOrderStatusSchema>;

export const deliveredOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
}).strict();

export type DeliveredOtpBody = z.infer<typeof deliveredOtpSchema>;

export const recentlyViewedSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID."),
}).strict();

export type RecentlyViewedBody = z.infer<typeof recentlyViewedSchema>;
