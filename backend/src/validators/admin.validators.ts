import { z } from "zod";

import { MAX_PAGE_SIZE } from "../constants";
import { PASSWORD_RULES } from "../constants/auth";

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
}).strict();

export const reportDateQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  period: z.enum(["daily", "weekly", "monthly"]).optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).optional(),
}).strict();

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
}).strict();

export const customReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  group_by: z
    .enum(["status", "payment_method", "payment_status", "city", "day", "week", "month"])
    .default("status"),
  format: z.enum(["csv", "xlsx", "pdf"]).optional(),
}).strict();

export const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const growthQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

export const userIdParamsSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID."),
}).strict();

export const suspendUserSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
}).strict();

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(PASSWORD_RULES.MIN_LENGTH, `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters.`)
    .max(PASSWORD_RULES.MAX_LENGTH),
}).strict();

export const changeRoleSchema = z.object({
  role: z.enum(["customer", "vendor", "delivery", "admin", "super_admin"]),
}).strict();

export const updateAdminCredentialsSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required.").max(PASSWORD_RULES.MAX_LENGTH),
    email: z.string().trim().email("A valid email is required.").max(255).optional(),
    new_password: z
      .string()
      .min(PASSWORD_RULES.MIN_LENGTH, `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters.`)
      .max(PASSWORD_RULES.MAX_LENGTH)
      .optional(),
  })
  .strict()
  .refine((data) => data.email !== undefined || data.new_password !== undefined, {
    message: "Provide a new admin email and/or a new password.",
    path: ["email"],
  })
  .refine((data) => data.email !== undefined || data.new_password !== undefined, {
    message: "Provide a new admin email and/or a new password.",
    path: ["new_password"],
  });
export type UpdateAdminCredentialsBody = z.infer<typeof updateAdminCredentialsSchema>;

export const vendorIdParamsSchema = z.object({
  vendor_id: z.string().uuid("vendor_id must be a valid UUID."),
}).strict();

export const vendorDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional().nullable(),
}).strict();

export const deliveryIdParamsSchema = z.object({
  delivery_id: z.string().uuid("delivery_id must be a valid UUID."),
}).strict();

export const deliveryDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional().nullable(),
}).strict();

export const createDeliveryPartnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("A valid email is required.").max(255),
  password: z
    .string()
    .min(PASSWORD_RULES.MIN_LENGTH, `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters.`)
    .max(PASSWORD_RULES.MAX_LENGTH),
  phone: z.string().trim().max(20).optional().nullable(),
  vehicle_type: z.string().trim().min(1, "Vehicle type is required.").max(60),
  vehicle_number: z.string().trim().max(30).optional().nullable(),
  license_number: z.string().trim().max(60).optional().nullable(),
}).strict();
export type CreateDeliveryPartnerBody = z.infer<typeof createDeliveryPartnerSchema>;

export const suspendVendorSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
}).strict();

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
}).strict();

export const auditLogIdParamsSchema = z.object({
  audit_log_id: z.string().uuid("audit_log_id must be a valid UUID."),
}).strict();

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
}).strict();

export const announcementIdParamsSchema = z.object({
  announcement_id: z.string().uuid("announcement_id must be a valid UUID."),
}).strict();

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["all", "customer", "vendor", "delivery"]).optional(),
  is_active: z.boolean().optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  publish: z.boolean().optional(),
}).strict();

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  audience: z.enum(["all", "customer", "vendor", "delivery"]).optional(),
  is_active: z.boolean().optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
}).strict();

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
}).strict();

export const adminOrderIdParamsSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID."),
}).strict();

export const adminProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  is_active: z.enum(["true", "false"]).optional(),
  is_featured: z.enum(["true", "false"]).optional(),
  vendor_id: z.string().uuid("vendor_id must be a valid UUID.").optional(),
}).strict();

export const heroSlideIdParamsSchema = z.object({
  slide_id: z.string().uuid("slide_id must be a valid UUID."),
}).strict();

export const heroSlideQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(160).optional(),
  is_active: z.enum(["true", "false"]).optional(),
}).strict();

export const createHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300).optional(),
  body: z.string().trim().max(10000).optional(),
  image_url: z.string().trim().max(500).optional(),
  link_url: z.string().trim().max(500).optional(),
  link_text: z.string().trim().max(100).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
}).strict();

export const updateHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  body: z.string().trim().max(10000).optional(),
  image_url: z.string().trim().max(500).optional(),
  link_url: z.string().trim().max(500).optional(),
  link_text: z.string().trim().max(100).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
}).strict();

export const updateVendorMembershipSchema = z.object({
  membership_plan_id: z.string().uuid("Invalid plan ID format").optional().nullable(),
  commission_rate: z.number().min(0).max(100).optional().nullable(),
  membership_tier: z.string().trim().max(50).optional().nullable(),
  membership_expires_at: z.string().datetime().optional().nullable(),
}).strict();
export type UpdateVendorMembershipBody = z.infer<typeof updateVendorMembershipSchema>;

export const updateVendorPromotionSchema = z.object({
  is_sponsored: z.boolean(),
  sponsored_until: z.string().datetime().optional().nullable(),
  sponsored_priority: z.number().int().min(0).optional().nullable(),
}).strict();
export type UpdateVendorPromotionBody = z.infer<typeof updateVendorPromotionSchema>;

const billingPeriodSchema = z.enum(["monthly", "quarterly", "yearly", "lifetime"]);

export const createMembershipPlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  price: z.coerce.number().min(0),
  billing_period: billingPeriodSchema,
  features: z.array(z.string().trim().min(1).max(200)).default([]),
  product_limit: z.coerce.number().int().min(0).max(100000).default(20),
  daily_order_limit: z.coerce.number().int().min(0).max(100000).default(5),
  commission_rate: z.coerce.number().min(0).max(100).default(5),
  includes_sponsorship: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
}).strict();
export type CreateMembershipPlanBody = z.infer<typeof createMembershipPlanSchema>;

export const updateMembershipPlanSchema = createMembershipPlanSchema.partial();
export type UpdateMembershipPlanBody = z.infer<typeof updateMembershipPlanSchema>;

export const membershipPlanIdParamsSchema = z.object({
  plan_id: z.string().uuid("Invalid plan ID format"),
}).strict();


export const ticketIdParamsSchema = z.object({
  ticket_id: z.string().uuid("Invalid ticket ID format"),
}).strict();

export const updateTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"]),
  resolved_at: z.string().datetime().optional(),
}).strict();

export const maintenanceTaskParamsSchema = z.object({
  type: z.string().trim().min(1).max(50),
}).strict();

export const updateMaintenanceContactSchema = z.object({
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().trim().max(30).optional().nullable(),
}).strict();
