import { z } from "zod";

export const couponIdParamsSchema = z.object({
  coupon_id: z.string().uuid("coupon_id must be a valid UUID."),
}).strict();

const couponTypeEnum = z.enum(["PERCENTAGE", "FIXED", "FREE_DELIVERY"]);

export const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters.")
    .max(50, "Code must not exceed 50 characters.")
    .transform((val) => val.toUpperCase()),
  type: couponTypeEnum,
  value: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, "Value must be non-negative.").default(0)
  ),
  max_discount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.number().min(0).optional().nullable()
  ),
  min_order_value: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.number().min(0).optional().nullable()
  ),
  usage_limit: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : val),
    z.coerce.number().int().min(0).default(0)
  ),
  per_user_limit: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 1 : val),
    z.coerce.number().int().min(0).default(1)
  ),
  valid_from: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional().default(() => new Date(Date.now() - 60000))
  ),
  valid_until: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional().default(() => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
  ),
  is_active: z.boolean().optional().default(true),
  applies_to_vendor_ids: z.array(z.string().uuid("Invalid vendor id.")).optional().nullable(),
  applies_to_product_ids: z.array(z.string().uuid("Invalid product id.")).optional().nullable(),
  applies_to_category_ids: z.array(z.string().uuid("Invalid category id.")).optional().nullable(),
}).strict().superRefine((data, ctx) => {
  if (data.valid_until && data.valid_from && data.valid_until <= data.valid_from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expiry date (valid_until) must be after start date (valid_from).",
      path: ["valid_until"],
    });
  }
  if (data.type === "PERCENTAGE") {
    if (data.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discount must be greater than 0%.",
        path: ["value"],
      });
    } else if (data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discount cannot exceed 100%.",
        path: ["value"],
      });
    }
  } else if (data.type === "FIXED") {
    if (data.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed discount amount must be greater than ₹0.",
        path: ["value"],
      });
    }
  }
});

export const updateCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters.")
    .max(50)
    .transform((val) => val.toUpperCase())
    .optional(),
  type: couponTypeEnum.optional(),
  value: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(0).optional()
  ),
  max_discount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.number().min(0).optional().nullable()
  ),
  min_order_value: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.number().min(0).optional().nullable()
  ),
  usage_limit: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().min(0).optional()
  ),
  per_user_limit: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().min(0).optional()
  ),
  valid_from: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional()
  ),
  valid_until: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional()
  ),
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

export const testCouponSchema = z.object({
  code: z.string().trim().min(1, "code is required.").max(50),
  order_value: z.coerce.number().min(0).optional().default(500),
}).strict();

export type CreateCouponBody = z.infer<typeof createCouponSchema>;
export type UpdateCouponBody = z.infer<typeof updateCouponSchema>;
export type TestCouponBody = z.infer<typeof testCouponSchema>;

