import { z } from "zod";

import { MAX_PAGE_SIZE } from "../constants";
import { PASSWORD_RULES } from "../constants/auth";

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
});

export const reportDateQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  period: z.enum(["daily", "weekly", "monthly"]).optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).optional(),
});

export const reportOrdersQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  status: z.string().trim().max(40).optional(),
  payment_status: z.string().trim().max(40).optional(),
  payment_method: z.string().trim().max(20).optional(),
  q: z.string().trim().max(160).optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).optional(),
});

export const customReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  group_by: z
    .enum(["status", "payment_method", "payment_status", "city", "day", "week", "month"])
    .default("status"),
  format: z.enum(["csv", "xlsx", "pdf"]).optional(),
});

export const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const growthQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const userIdParamsSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID."),
});

export const suspendUserSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(PASSWORD_RULES.MIN_LENGTH, `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters.`)
    .max(PASSWORD_RULES.MAX_LENGTH),
});

export const changeRoleSchema = z.object({
  role: z.enum(["customer", "vendor", "delivery", "admin", "super_admin"]),
});

export const vendorIdParamsSchema = z.object({
  vendor_id: z.string().uuid("vendor_id must be a valid UUID."),
});

export const vendorDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const deliveryIdParamsSchema = z.object({
  delivery_id: z.string().uuid("delivery_id must be a valid UUID."),
});

export const deliveryDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const suspendVendorSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  action: z.string().trim().max(120).optional(),
  entity_type: z.string().trim().max(80).optional(),
  entity_id: z.string().trim().max(80).optional(),
  user_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const auditLogIdParamsSchema = z.object({
  audit_log_id: z.string().uuid("audit_log_id must be a valid UUID."),
});

export const settingsUpdateSchema = z
  .object({
    "platform.name": z.string().trim().min(1).max(120).optional(),
    "platform.currency": z.string().trim().min(1).max(10).optional(),
    "platform.tax_rate_percent": z.coerce.number().min(0).max(100).optional(),
    "platform.delivery_fee": z.coerce.number().min(0).max(10000).optional(),
    "platform.free_delivery_threshold": z.coerce.number().min(0).optional(),
    "platform.min_order_value": z.coerce.number().min(0).optional(),
    "platform.order_expiry_minutes": z.coerce.number().int().min(1).max(1440).optional(),
    "platform.max_order_quantity": z.coerce.number().int().min(1).max(100).optional(),
    "platform.max_cart_items": z.coerce.number().int().min(1).max(500).optional(),
    "platform.maintenance_mode": z.boolean().optional(),
    "platform.logo_url": z.string().trim().url().max(500).optional().nullable(),
    "notifications.announcement_enabled": z.boolean().optional(),
    "support.email": z.string().trim().email().optional(),
    "support.phone": z.string().trim().max(30).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided.",
  });

export const announcementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  audience: z.enum(["all", "customer", "vendor", "delivery"]).optional(),
  is_active: z.enum(["true", "false"]).optional(),
  published: z.enum(["true", "false"]).optional(),
});

export const announcementIdParamsSchema = z.object({
  announcement_id: z.string().uuid("announcement_id must be a valid UUID."),
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["all", "customer", "vendor", "delivery"]).optional(),
  is_active: z.boolean().optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  publish: z.boolean().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  audience: z.enum(["all", "customer", "vendor", "delivery"]).optional(),
  is_active: z.boolean().optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
});

export const adminOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  status: z.string().trim().max(40).optional(),
  payment_status: z.string().trim().max(40).optional(),
  payment_method: z.string().trim().max(20).optional(),
  vendor_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const adminOrderIdParamsSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID."),
});

export const adminProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  is_active: z.enum(["true", "false"]).optional(),
  is_featured: z.enum(["true", "false"]).optional(),
});

export const heroSlideIdParamsSchema = z.object({
  slide_id: z.string().uuid("slide_id must be a valid UUID."),
});

export const heroSlideQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  is_active: z.enum(["true", "false"]).optional(),
});

export const createHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300).optional(),
  body: z.string().trim().max(10000).optional(),
  image_url: z.string().trim().max(500).optional(),
  link_url: z.string().trim().max(500).optional(),
  link_text: z.string().trim().max(100).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

export const updateHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  body: z.string().trim().max(10000).optional(),
  image_url: z.string().trim().max(500).optional(),
  link_url: z.string().trim().max(500).optional(),
  link_text: z.string().trim().max(100).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});
