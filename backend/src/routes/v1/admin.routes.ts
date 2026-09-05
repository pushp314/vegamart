import { Router } from "express";

import {
  activateUser,
  changeUserRole,
  createDeliveryPartner,
  deleteUser,
  deleteVendorAdmin,
  forceLogoutUser,
  getAuditLog,
  getDashboard,
  getDeliveryPartner,
  getOrder,
  deleteProduct,
  getUser,
  getVendorAdmin,
  getVendorEarnings,
  listAuditLogs,
  listDeliveryPartners,
  listOrders,
  listProductsAdmin,
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
  updateAdminCredentials,
  updateOrderStatus,
  updateVendorCommission,
  updateVendorMembership,
  updateVendorPromotion,
  listSupportTickets,
  updateSupportTicketStatus,
  listMembershipPlans,
  getMembershipPlan,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  getMaintenanceStatus,
  completeMaintenanceTask,
  updateMaintenanceContact,
  getPayoutSummary,
  getVendorsWithPendingPayouts,
  disburseVendorPayout,
  disburseAllPendingPayouts,
  exportPayoutsCsv,
  getDisputesQueue,
  getStorageHealthMetrics,
  listPayoutRequests,
  processPayoutRequest,
  bypassSubOrder,
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
import {
  createHeroSlide,
  deleteHeroSlide,
  getHeroSlide,
  listHeroSlides,
  publishHeroSlide,
  unpublishHeroSlide,
  updateHeroSlide,
} from "../../controllers/hero-slide.controller";
import {
  createVideoAd,
  deleteVideoAd,
  getVideoAd,
  listVideoAds,
  publishVideoAd,
  unpublishVideoAd,
  updateVideoAd,
} from "../../controllers/video-ad.controller";
import {
  createVideoAdSchema,
  updateVideoAdSchema,
  videoAdIdParamsSchema,
  videoAdQuerySchema,
} from "../../validators/video-ad.validators";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { apiLimiter, adminLimiter } from "../../middlewares/rate-limit.middleware";
import { ROLES } from "../../constants/roles";
import {
  adminOrderIdParamsSchema,
  adminOrderQuerySchema,
  adminPaginationQuerySchema,
  adminProductsQuerySchema,
  analyticsQuerySchema,
  announcementIdParamsSchema,
  announcementQuerySchema,
  auditLogIdParamsSchema,
  auditLogQuerySchema,
  changeRoleSchema,
  createAnnouncementSchema,
  createDeliveryPartnerSchema,
  createHeroSlideSchema,
  customReportQuerySchema,
  deliveryDecisionSchema,
  deliveryIdParamsSchema,
  growthQuerySchema,
  heroSlideIdParamsSchema,
  heroSlideQuerySchema,
  reportDateQuerySchema,
  reportOrdersQuerySchema,
  resetPasswordSchema,
  settingsUpdateSchema,
  suspendUserSchema,
  suspendVendorSchema,
  updateAdminCredentialsSchema,
  updateAnnouncementSchema,
  updateHeroSlideSchema,
  userIdParamsSchema,
  vendorDecisionSchema,
  vendorIdParamsSchema,
  updateVendorCommissionSchema,
  updateVendorMembershipSchema,
  updateVendorPromotionSchema,
  ticketIdParamsSchema,
  updateTicketStatusSchema,
  createMembershipPlanSchema,
  updateMembershipPlanSchema,
  membershipPlanIdParamsSchema,
  maintenanceTaskParamsSchema,
  updateMaintenanceContactSchema,
} from "../../validators/admin.validators";

import { productIdParamsSchema } from "../../validators/product.validators";

const router = Router();

router.use(adminLimiter, authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// Dashboard
router.get("/dashboard", getDashboard);

// Admin account / credentials
router.patch(
  "/credentials",
  validate({ body: updateAdminCredentialsSchema }),
  updateAdminCredentials
);

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
router.patch("/vendors/:vendor_id/commission", validate({ params: vendorIdParamsSchema, body: updateVendorCommissionSchema }), updateVendorCommission);
router.patch("/vendors/:vendor_id/membership", validate({ params: vendorIdParamsSchema, body: updateVendorMembershipSchema }), updateVendorMembership);
router.patch("/vendors/:vendor_id/promote", validate({ params: vendorIdParamsSchema, body: updateVendorPromotionSchema }), updateVendorPromotion);
router.delete("/vendors/:vendor_id", validate({ params: vendorIdParamsSchema }), deleteVendorAdmin);

// Membership plans
router.get("/membership-plans", listMembershipPlans);
router.get("/membership-plans/:plan_id", validate({ params: membershipPlanIdParamsSchema }), getMembershipPlan);
router.post("/membership-plans", validate({ body: createMembershipPlanSchema }), createMembershipPlan);
router.patch("/membership-plans/:plan_id", validate({ params: membershipPlanIdParamsSchema, body: updateMembershipPlanSchema }), updateMembershipPlan);
router.delete("/membership-plans/:plan_id", validate({ params: membershipPlanIdParamsSchema }), deleteMembershipPlan);
router.get("/vendors/:vendor_id/earnings", validate({ params: vendorIdParamsSchema }), getVendorEarnings);

// Vendor Payouts Hub
router.get("/payouts/summary", getPayoutSummary);
router.get("/payouts/vendors", getVendorsWithPendingPayouts);
router.get("/payouts/requests", listPayoutRequests);
router.post("/payouts/requests/:id/process", processPayoutRequest);
router.post("/payouts/disburse/:vendor_id", validate({ params: vendorIdParamsSchema }), disburseVendorPayout);
router.post("/payouts/disburse-all", disburseAllPendingPayouts);
router.get("/payouts/export-csv", exportPayoutsCsv);

// Customer Disputes & Refunds Hub
router.get("/disputes", getDisputesQueue);

// Delivery partner management
router.post(
  "/delivery-partners",
  validate({ body: createDeliveryPartnerSchema }),
  createDeliveryPartner
);
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

// Settings & Storage Health
router.get("/settings", getSettings);
router.patch("/settings", validate({ body: settingsUpdateSchema }), updateSettings);
router.put("/settings", validate({ body: settingsUpdateSchema }), updateSettings);
router.get("/storage/metrics", getStorageHealthMetrics);

// Maintenance scheduling & alerts
router.get("/maintenance", getMaintenanceStatus);
router.post(
  "/maintenance/:type/done",
  validate({ params: maintenanceTaskParamsSchema }),
  completeMaintenanceTask
);
router.patch(
  "/maintenance/contact",
  validate({ body: updateMaintenanceContactSchema }),
  updateMaintenanceContact
);

// Announcements
router.get("/announcements", validate({ query: announcementQuerySchema }), listAnnouncements);
router.post("/announcements", validate({ body: createAnnouncementSchema }), createAnnouncement);
router.get("/announcements/:announcement_id", validate({ params: announcementIdParamsSchema }), getAnnouncement);
router.patch("/announcements/:announcement_id", validate({ params: announcementIdParamsSchema, body: updateAnnouncementSchema }), updateAnnouncement);
router.post("/announcements/:announcement_id/publish", validate({ params: announcementIdParamsSchema }), publishAnnouncement);
router.post("/announcements/:announcement_id/unpublish", validate({ params: announcementIdParamsSchema }), unpublishAnnouncement);
router.delete("/announcements/:announcement_id", validate({ params: announcementIdParamsSchema }), deleteAnnouncement);

// Hero Slides
router.get("/hero-slides", validate({ query: heroSlideQuerySchema }), listHeroSlides);
router.post("/hero-slides", validate({ body: createHeroSlideSchema }), createHeroSlide);
router.get("/hero-slides/:slide_id", validate({ params: heroSlideIdParamsSchema }), getHeroSlide);
router.patch("/hero-slides/:slide_id", validate({ params: heroSlideIdParamsSchema, body: updateHeroSlideSchema }), updateHeroSlide);
router.post("/hero-slides/:slide_id/publish", validate({ params: heroSlideIdParamsSchema }), publishHeroSlide);
router.post("/hero-slides/:slide_id/unpublish", validate({ params: heroSlideIdParamsSchema }), unpublishHeroSlide);
router.delete("/hero-slides/:slide_id", validate({ params: heroSlideIdParamsSchema }), deleteHeroSlide);

// Video Ads
router.get("/video-ads", validate({ query: videoAdQuerySchema }), listVideoAds);
router.post("/video-ads", validate({ body: createVideoAdSchema }), createVideoAd);
router.get("/video-ads/:ad_id", validate({ params: videoAdIdParamsSchema }), getVideoAd);
router.patch("/video-ads/:ad_id", validate({ params: videoAdIdParamsSchema, body: updateVideoAdSchema }), updateVideoAd);
router.post("/video-ads/:ad_id/publish", validate({ params: videoAdIdParamsSchema }), publishVideoAd);
router.post("/video-ads/:ad_id/unpublish", validate({ params: videoAdIdParamsSchema }), unpublishVideoAd);
router.delete("/video-ads/:ad_id", validate({ params: videoAdIdParamsSchema }), deleteVideoAd);

// Order management
router.get("/orders", validate({ query: adminOrderQuerySchema }), listOrders);
router.get("/orders/:order_id", validate({ params: adminOrderIdParamsSchema }), getOrder);
router.patch("/orders/:order_id/status", validate({ params: adminOrderIdParamsSchema }), updateOrderStatus);
router.post("/orders/:order_id/sub-orders/:subId/bypass", bypassSubOrder);

// Product management
router.get("/products", validate({ query: adminProductsQuerySchema }), listProductsAdmin);
router.delete("/products/:product_id", validate({ params: productIdParamsSchema }), deleteProduct);

export default router;


// Support Tickets
router.get("/support-tickets", listSupportTickets);
router.patch("/support-tickets/:ticket_id/status", validate({ params: ticketIdParamsSchema, body: updateTicketStatusSchema }), updateSupportTicketStatus);
