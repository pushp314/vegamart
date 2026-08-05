import { z } from "zod";

export const couponIdParamsSchema = z.object({
  coupon_id: z.string().uuid("coupon_id must be a valid UUID."),
}).strict();

const couponTypeEnum = z.enum(["PERCENTAGE", "FIXED", "FREE_DELIVERY"]);

export const createCouponSchema = z.object({
  code: z.string().trim().min(2, "Code must be at least 2 characters.").max(50),
  type: couponTypeEnum,
  value: z.coerce.number().min(0, "Value must be non-negative."),
  max_discount: z.coerce.number().min(0).optional().nullable(),
  min_order_value: z.coerce.number().min(0).optional().nullable(),
  usage_limit: z.coerce.number().int().min(0).default(0),
  per_user_limit: z.coerce.number().int().min(0).default(1),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date(),
  is_active: z.boolean().optional(),
  applies_to_vendor_ids: z.array(z.string().uuid("Invalid vendor id.")).optional().nullable(),
  applies_to_product_ids: z.array(z.string().uuid("Invalid product id.")).optional().nullable(),
  applies_to_category_ids: z.array(z.string().uuid("Invalid category id.")).optional().nullable(),
}).strict().refine((data) => data.valid_until > data.valid_from, {
  message: "valid_until must be after valid_from.",
  path: ["valid_until"],
});

export const updateCouponSchema = z.object({
  code: z.string().trim().min(2, "Code must be at least 2 characters.").max(50).optional(),
  type: couponTypeEnum.optional(),
  value: z.coerce.number().min(0).optional(),
  max_discount: z.coerce.number().min(0).optional().nullable(),
  min_order_value: z.coerce.number().min(0).optional().nullable(),
  usage_limit: z.coerce.number().int().min(0).optional(),
  per_user_limit: z.coerce.number().int().min(0).optional(),
  valid_from: z.coerce.date().optional(),
  valid_until: z.coerce.date().optional(),
  is_active: z.boolean().optional(),
  applies_to_vendor_ids: z.array(z.string().uuid("Invalid vendor id.")).optional().nullable(),
  applies_to_product_ids: z.array(z.string().uuid("Invalid product id.")).optional().nullable(),
  applies_to_category_ids: z.array(z.string().uuid("Invalid category id.")).optional().nullable(),
}).strict();

export const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  is_active: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(160).optional(),
  type: couponTypeEnum.optional(),
}).strict();

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1, "code is required.").max(50),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Invalid product id."),
        quantity: z.coerce.number().int().min(1, "quantity must be at least 1."),
      })
    )
    .min(1)
    .max(100)
    .optional(),
}).strict();

export type CreateCouponBody = z.infer<typeof createCouponSchema>;
export type UpdateCouponBody = z.infer<typeof updateCouponSchema>;
