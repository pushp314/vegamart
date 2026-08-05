import { Router } from "express";

import {
  addRecentlyViewed,
  approveDeliveryAlias,
  approveVendorAlias,
  cancelVendorApplication,
  createCmsBannerAlias,
  createMyAddress,
  createOrderAlias,
  featureProductAlias,
  getVendorEarnings,
  getVendorKyc,
  listBanners,
  listDeliveryPartnersAlias,
  listFeaturedProducts,
  listMyAddresses,
  listRecentlyViewed,
  listRecommended,
  listTrendingProducts,
  listVendorOrdersAlias,
  registerVendor,
  rejectDeliveryAlias,
  rejectVendorAlias,
  removeMyAddress,
  reorderOrder,
  returnOrder,
  ringBell,
  sendLoginOtpAlias,
  setDefaultMyAddress,
  submitVendorKyc,
  suspendVendorAlias,
  toggleAvailabilityAlias,
  toggleUserStatusAlias,
  updateMyAddress,
  updateMyProfile,
  verifyLoginOtpAlias,
} from "../../controllers/integration.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { otpLimiter, adminLimiter } from "../../middlewares/rate-limit.middleware";
import { ROLES } from "../../constants/roles";
import { vendorIdParamsSchema } from "../../validators/vendor.validators";
import {
  createOrderAliasSchema,
  createCmsBannerSchema,
  featureProductSchema,
  orderIdAliasParamsSchema,
  productIdAliasParamsSchema,
  recentlyViewedSchema,
  ringBellSchema,
  sendLoginOtpSchema,
  vendorKycSchema,
  vendorRegisterSchema,
  verifyLoginOtpSchema,
} from "../../validators/integration.validators";

const router = Router();

// ---------------------------------------------------------------------------
// Auth OTP aliases
// ---------------------------------------------------------------------------
router.post("/auth/login/otp/send", otpLimiter, validate({ body: sendLoginOtpSchema }), sendLoginOtpAlias);
router.post("/auth/login/otp/verify", otpLimiter, validate({ body: verifyLoginOtpSchema }), verifyLoginOtpAlias);

// ---------------------------------------------------------------------------
// Public browse
// ---------------------------------------------------------------------------
router.get("/banners", listBanners);
router.get("/products/trending", listTrendingProducts);
router.get("/products/featured", listFeaturedProducts);

// ---------------------------------------------------------------------------
// Customer self-service (users/me)
// ---------------------------------------------------------------------------
router.get("/users/me/addresses", authenticate, listMyAddresses);
router.post("/users/me/addresses", authenticate, createMyAddress);
router.put("/users/me/addresses/:id", authenticate, updateMyAddress);
router.delete("/users/me/addresses/:id", authenticate, removeMyAddress);
router.put("/users/me/addresses/:id/default", authenticate, setDefaultMyAddress);
router.get("/users/me/recently-viewed", authenticate, listRecentlyViewed);
router.post("/users/me/recently-viewed", authenticate, validate({ body: recentlyViewedSchema }), addRecentlyViewed);
router.get("/users/me/recommended", authenticate, listRecommended);

// ---------------------------------------------------------------------------
// Checkout alias
// ---------------------------------------------------------------------------
router.post(
  "/checkout/create-order",
  authenticate,
  requireRole(ROLES.CUSTOMER),
  validate({ body: createOrderAliasSchema }),
  createOrderAlias
);

// ---------------------------------------------------------------------------
// Orders aliases (registered before generic /orders/:order_id in order routes)
// ---------------------------------------------------------------------------
router.get("/orders/vendor", authenticate, requireRole(ROLES.VENDOR), listVendorOrdersAlias);
router.post("/orders/:id/reorder", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdAliasParamsSchema }), reorderOrder);
router.post("/orders/:id/return", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdAliasParamsSchema }), returnOrder);

// ---------------------------------------------------------------------------
// Vendor self-service
// ---------------------------------------------------------------------------
router.post("/vendors/register", authenticate, validate({ body: vendorRegisterSchema }), registerVendor);
router.delete("/vendors/me", authenticate, requireRole(ROLES.VENDOR), cancelVendorApplication);
router.put("/vendors/me/availability", authenticate, requireRole(ROLES.VENDOR), toggleAvailabilityAlias);
router.put("/vendors/me/toggle-availability", authenticate, requireRole(ROLES.VENDOR), toggleAvailabilityAlias);
router.put("/vendors/me/profile", authenticate, requireRole(ROLES.VENDOR), updateMyProfile);
router.get("/vendors/me/kyc", authenticate, requireRole(ROLES.VENDOR), getVendorKyc);
router.post("/vendors/me/kyc", authenticate, requireRole(ROLES.VENDOR), validate({ body: vendorKycSchema }), submitVendorKyc);
router.get("/vendors/me/earnings", authenticate, requireRole(ROLES.VENDOR), getVendorEarnings);
router.post(
  "/vendors/:vendor_id/ring-bell",
  authenticate,
  validate({ params: vendorIdParamsSchema, body: ringBellSchema }),
  ringBell
);


export default router;

export const integrationAdminRoutes = Router();
integrationAdminRoutes.use(adminLimiter, authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));
integrationAdminRoutes.get("/delivery", listDeliveryPartnersAlias);
integrationAdminRoutes.put("/vendors/:vendor_id/approve", approveVendorAlias);
integrationAdminRoutes.put("/vendors/:vendor_id/reject", rejectVendorAlias);
integrationAdminRoutes.put("/vendors/:vendor_id/suspend", suspendVendorAlias);
integrationAdminRoutes.put("/users/:user_id/status", toggleUserStatusAlias);
integrationAdminRoutes.put("/delivery/:delivery_id/approve", approveDeliveryAlias);
integrationAdminRoutes.put("/delivery/:delivery_id/reject", rejectDeliveryAlias);
integrationAdminRoutes.post("/cms/banners", validate({ body: createCmsBannerSchema }), createCmsBannerAlias);
integrationAdminRoutes.put("/products/:product_id/feature", validate({ params: productIdAliasParamsSchema, body: featureProductSchema }), featureProductAlias);
