import { z } from "zod";

export const addressIdParamsSchema = z.object({
  address_id: z.string().uuid("address_id must be a valid UUID."),
}).strict();

export const createAddressSchema = z.object({
  label: z.string().trim().min(1, "label is required.").max(60),
  full_address: z.string().trim().min(3, "full_address is required.").max(400),
  landmark: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1, "city is required.").max(100),
  state: z.string().trim().min(1, "state is required.").max(100),
  pincode: z.string().trim().min(3, "pincode is required.").max(10),
  country: z.string().trim().max(60).default("India"),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  is_default: z.boolean().optional(),
}).strict();

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressBody = z.infer<typeof createAddressSchema>;
export type UpdateAddressBody = z.infer<typeof updateAddressSchema>;
