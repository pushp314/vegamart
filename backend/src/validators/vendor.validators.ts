import { z } from "zod";

import { MAX_PAGE_SIZE } from "../constants";

export const vendorIdParamsSchema = z.object({
  vendor_id: z.string().uuid("vendor_id must be a valid UUID."),
});

export const vendorSlugParamsSchema = z.object({
  slug: z.string().min(1).max(180),
});

export const createVendorSchema = z.object({
  business_name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(160),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  tags: z.string().trim().max(300).optional().nullable(),
  logo_url: z.string().url().max(500).optional().nullable(),
  banner_url: z.string().url().max(500).optional().nullable(),
  address: z.string().trim().min(5).max(300),
  landmark: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(60).optional(),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits."),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  delivery_radius_km: z.coerce.number().min(0.5).max(50).optional(),
  business_hours: z.string().max(500).optional().nullable(),
  min_order: z.coerce.number().min(0).optional(),
  delivery_fee: z.coerce.number().min(0).optional(),
  owner_name: z.string().trim().max(120).optional().nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone must be 10-15 digits, optionally prefixed with +.")
    .optional()
    .nullable(),
  available_from: z.string().max(20).optional().nullable(),
  available_to: z.string().max(20).optional().nullable(),
  roaming: z.boolean().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const vendorAvailabilitySchema = z.object({
  is_open: z.boolean(),
});

export const vendorLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const vendorLocationUpdateSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  address: z.string().trim().min(5).max(300).optional(),
  landmark: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  country: z.string().trim().min(1).max(60).optional(),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits.").optional(),
  delivery_radius_km: z.coerce.number().min(0.5).max(50).optional(),
});

export const vendorHoursSchema = z.object({
  business_hours: z.string().max(500),
  available_from: z.string().max(20).optional().nullable(),
  available_to: z.string().max(20).optional().nullable(),
});

export const vendorReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional().nullable(),
});

export const listVendorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  city: z.string().trim().max(100).optional(),
  category: z.string().trim().max(120).optional(),
  is_open: z.enum(["true", "false"]).optional(),
  sort: z.enum(["relevance", "rating", "name", "distance", "newest"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const nearbyVendorsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.5).max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  category: z.string().trim().max(120).optional(),
  is_open: z.enum(["true", "false"]).optional(),
});

export type CreateVendorBody = z.infer<typeof createVendorSchema>;
export type UpdateVendorBody = z.infer<typeof updateVendorSchema>;
export type VendorLocationBody = z.infer<typeof vendorLocationUpdateSchema>;
