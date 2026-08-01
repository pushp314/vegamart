import { Router } from "express";

import {
  activateUser,
  changeUserRole,
  deleteUser,
  forceLogoutUser,
  getAuditLog,
  getDashboard,
  getDeliveryPartner,
  getUser,
  getVendorAdmin,
  getVendorEarnings,
  listAuditLogs,
  listDeliveryPartners,
  listUsers,
  listVendorsAdmin,
  resetUserPassword,
  restoreDeliveryPartner,
  restoreUser,
  restoreVendorAdmin,
  reviewDeliveryPartner,
  reviewVendorAdmin,
  suspendDeliveryPartner,
  suspendUser,
  suspendVendorAdmin,
} from "../../controllers/admin.controller";
import {
  analyticsCategorySales,
  analyticsGrowth,
  analyticsTopCustomers,
  analyticsTopProducts,
  analyticsTopVendors,
  analyticsTrends,
  customReport,
  ordersReport,
  productsReport,
  revenueReport,
  vendorsReport,
} from "../../controllers/report.controller";
import { getSettings, updateSettings } from "../../controllers/settings.controller";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  listAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
} from "../../controllers/announcement.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { apiLimiter } from "../../middlewares/rate-limit.middleware";
import { ROLES } from "../../constants/roles";
import {
  adminPaginationQuerySchema,
  analyticsQuerySchema,
  announcementIdParamsSchema,
  announcementQuerySchema,
  auditLogIdParamsSchema,
  auditLogQuerySchema,
  changeRoleSchema,
  createAnnouncementSchema,
  customReportQuerySchema,
  deliveryDecisionSchema,
  deliveryIdParamsSchema,
  growthQuerySchema,
  reportDateQuerySchema,
  reportOrdersQuerySchema,
  resetPasswordSchema,
  settingsUpdateSchema,
  suspendUserSchema,
  suspendVendorSchema,
  updateAnnouncementSchema,
  userIdParamsSchema,
  vendorDecisionSchema,
  vendorIdParamsSchema,
} from "../../validators/admin.validators";

const router = Router();

router.use(authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// Dashboard
router.get("/dashboard", getDashboard);

// User management
router.get("/users", validate({ query: adminPaginationQuerySchema }), listUsers);
router.get("/users/:user_id", validate({ params: userIdParamsSchema }), getUser);
router.post("/users/:user_id/suspend", validate({ params: userIdParamsSchema, body: suspendUserSchema }), suspendUser);
router.post("/users/:user_id/activate", validate({ params: userIdParamsSchema }), activateUser);
router.delete("/users/:user_id", validate({ params: userIdParamsSchema }), deleteUser);
router.post("/users/:user_id/restore", validate({ params: userIdParamsSchema }), restoreUser);
router.post("/users/:user_id/reset-password", validate({ params: userIdParamsSchema, body: resetPasswordSchema }), resetUserPassword);
router.post("/users/:user_id/force-logout", validate({ params: userIdParamsSchema }), forceLogoutUser);
router.patch("/users/:user_id/role", validate({ params: userIdParamsSchema, body: changeRoleSchema }), changeUserRole);

// Vendor management
router.get("/vendors", validate({ query: adminPaginationQuerySchema }), listVendorsAdmin);
router.get("/vendors/:vendor_id", validate({ params: vendorIdParamsSchema }), getVendorAdmin);
router.post("/vendors/:vendor_id/review", validate({ params: vendorIdParamsSchema, body: vendorDecisionSchema }), reviewVendorAdmin);
router.post("/vendors/:vendor_id/suspend", validate({ params: vendorIdParamsSchema, body: suspendVendorSchema }), suspendVendorAdmin);
router.post("/vendors/:vendor_id/restore", validate({ params: vendorIdParamsSchema }), restoreVendorAdmin);
router.get("/vendors/:vendor_id/earnings", validate({ params: vendorIdParamsSchema }), getVendorEarnings);

// Delivery partner management
router.get("/delivery-partners", validate({ query: adminPaginationQuerySchema }), listDeliveryPartners);
router.get("/delivery-partners/:delivery_id", validate({ params: deliveryIdParamsSchema }), getDeliveryPartner);
router.post(
  "/delivery-partners/:delivery_id/review",
  validate({ params: deliveryIdParamsSchema, body: deliveryDecisionSchema }),
  reviewDeliveryPartner
);
router.post(
  "/delivery-partners/:delivery_id/suspend",
  validate({ params: deliveryIdParamsSchema, body: suspendUserSchema }),
  suspendDeliveryPartner
);
router.post(
  "/delivery-partners/:delivery_id/restore",
  validate({ params: deliveryIdParamsSchema }),
  restoreDeliveryPartner
);

// Reports (rate-limited)
router.get("/reports/revenue", apiLimiter, validate({ query: reportDateQuerySchema }), revenueReport);
router.get("/reports/vendors", apiLimiter, validate({ query: reportDateQuerySchema }), vendorsReport);
router.get("/reports/products", apiLimiter, validate({ query: reportDateQuerySchema }), productsReport);
router.get("/reports/custom", apiLimiter, validate({ query: customReportQuerySchema }), customReport);
router.get("/reports/orders", apiLimiter, validate({ query: reportOrdersQuerySchema }), ordersReport);

// Analytics
router.get("/analytics/top-products", validate({ query: analyticsQuerySchema }), analyticsTopProducts);
router.get("/analytics/top-vendors", validate({ query: analyticsQuerySchema }), analyticsTopVendors);
router.get("/analytics/top-customers", validate({ query: analyticsQuerySchema }), analyticsTopCustomers);
router.get("/analytics/category-sales", validate({ query: analyticsQuerySchema }), analyticsCategorySales);
router.get("/analytics/trends", validate({ query: analyticsQuerySchema }), analyticsTrends);
router.get("/analytics/growth", validate({ query: growthQuerySchema }), analyticsGrowth);

// Audit logs
router.get("/audit-logs", validate({ query: auditLogQuerySchema }), listAuditLogs);
router.get("/audit-logs/:audit_log_id", validate({ params: auditLogIdParamsSchema }), getAuditLog);

// Settings
router.get("/settings", getSettings);
router.patch("/settings", validate({ body: settingsUpdateSchema }), updateSettings);

// Announcements
router.get("/announcements", validate({ query: announcementQuerySchema }), listAnnouncements);
router.post("/announcements", validate({ body: createAnnouncementSchema }), createAnnouncement);
router.get("/announcements/:announcement_id", validate({ params: announcementIdParamsSchema }), getAnnouncement);
router.patch("/announcements/:announcement_id", validate({ params: announcementIdParamsSchema, body: updateAnnouncementSchema }), updateAnnouncement);
router.post("/announcements/:announcement_id/publish", validate({ params: announcementIdParamsSchema }), publishAnnouncement);
router.post("/announcements/:announcement_id/unpublish", validate({ params: announcementIdParamsSchema }), unpublishAnnouncement);
router.delete("/announcements/:announcement_id", validate({ params: announcementIdParamsSchema }), deleteAnnouncement);

export default router;
