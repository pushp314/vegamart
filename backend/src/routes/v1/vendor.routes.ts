import { Router } from "express";

import {
  createVendorReview,
  cancelVendorApplication,
  createVendor,
  getMyDashboard,
  getMyDailyLocation,
  getMyLocation,
  getMyMembership,
  getMyReviews,
  getMyVendor,
  getVendorById,
  getVendorBySlug,
  getVendorDailyLocation,
  getVendorEarnings,
  getVendorKyc,
  getVendorLocation,
  getVendorAnalytics,
  listVendors,
  nearbyDailyLocations,
  nearbyVendors,
  patchVendorLocation,
  purchaseMembership,
  removeDailyLocation,
  reviewVendor,
  ringBell,
  setVendorAvailability,
  submitVendorKyc,
  suspendVendor,
  updateMyVendor,
  cancelMembership,
  verifyMembershipPayment,
  updateVendorHours,
  updateVendorLocation,
  upsertDailyLocation,
  bulkUploadProducts,
  createSuspensionAppeal,
  getVendorWallet,
  requestVendorWithdrawal,
  updateVendorBankDetails,
  exportVendorWalletStatement,
} from "../../controllers/vendor.controller";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
import { requirePlan } from "../../middlewares/subscription.middleware";
import { authenticate, optionalAuthenticate, blockGuest } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS, ROLES } from "../../constants/roles";
import {
  createVendorSchema,
  listVendorsQuerySchema,
  nearbyVendorsQuerySchema,
  purchaseMembershipSchema,
  upsertDailyLocationSchema,
  updateVendorSchema,
  vendorAvailabilitySchema,
  vendorHoursSchema,
  vendorIdParamsSchema,
  vendorLocationSchema,
  vendorLocationUpdateSchema,
  vendorReviewSchema,
  vendorSlugParamsSchema,
  verifyMembershipPaymentSchema,
} from "../../validators/vendor.validators";
import { vendorKycSchema, ringBellSchema } from "../../validators/integration.validators";
import { createReviewSchema } from "../../validators/product.validators";
import { upload } from "../../middlewares/upload.middleware";

const router = Router();

// Public routes
router.get("/vendors", validate({ query: listVendorsQuerySchema }), listVendors);
router.get("/vendors/nearby", optionalAuthenticate, validate({ query: nearbyVendorsQuerySchema }), nearbyVendors);
router.get("/vendors/by-slug/:slug", validate({ params: vendorSlugParamsSchema }), getVendorBySlug);

// Vendor self-service (must precede /vendors/:vendor_id)
router.get("/vendors/me", authenticate, getMyVendor);
router.delete("/vendors/me", authenticate, blockGuest, requireRole(ROLES.VENDOR), cancelVendorApplication);
router.post("/vendors", authenticate, requireRole(ROLES.VENDOR, ROLES.CUSTOMER), validate({ body: createVendorSchema }), createVendor);
router.put("/vendors/me", authenticate, validate({ body: updateVendorSchema }), updateMyVendor);
router.get("/vendors/me/kyc", authenticate, requireRole(ROLES.VENDOR), getVendorKyc);
router.post("/vendors/me/kyc", authenticate, blockGuest, requireRole(ROLES.VENDOR), validate({ body: vendorKycSchema }), submitVendorKyc);
router.get("/vendors/me/earnings", authenticate, requireRole(ROLES.VENDOR), getVendorEarnings);
router.get("/vendors/me/wallet", authenticate, requireRole(ROLES.VENDOR), getVendorWallet);
router.post("/vendors/me/withdrawals/request", authenticate, requireRole(ROLES.VENDOR), requestVendorWithdrawal);
router.put("/vendors/me/bank-details", authenticate, requireRole(ROLES.VENDOR), updateVendorBankDetails);
router.get("/vendors/me/wallet/statement/export", authenticate, requireRole(ROLES.VENDOR), exportVendorWalletStatement);
router.get("/vendors/me/membership", authenticate, requireRole(ROLES.VENDOR), getMyMembership);
router.post(
  "/vendors/me/membership",
  authenticate,
  requireRole(ROLES.VENDOR),
  validate({ body: purchaseMembershipSchema }),
  purchaseMembership
);
router.post(
  "/vendors/me/membership/verify",
  authenticate,
  requireRole(ROLES.VENDOR),
  validate({ body: verifyMembershipPaymentSchema }),
  verifyMembershipPayment
);
router.post(
  "/vendors/me/membership/cancel",
  authenticate,
  requireRole(ROLES.VENDOR),
  cancelMembership
);
router.post(
  "/vendors/me/suspension-appeal",
  authenticate,
  requireRole(ROLES.VENDOR),
  createSuspensionAppeal
);
router.get("/vendors/location", authenticate, getMyLocation);
router.patch(
  "/vendors/location",
  authenticate,
  validate({ body: vendorLocationUpdateSchema }),
  patchVendorLocation
);
router.put(
  "/vendors/me/availability",
  authenticate,
  validate({ body: vendorAvailabilitySchema }),
  setVendorAvailability
);
router.put(
  "/vendors/me/location",
  authenticate,
  validate({ body: vendorLocationSchema }),
  updateVendorLocation
);

router.post(
  "/vendors/products/bulk-upload",
  authenticate,
  requireRole(ROLES.VENDOR),
  upload.single("file"),
  bulkUploadProducts
);

router.put("/vendors/me/hours", authenticate, validate({ body: vendorHoursSchema }), updateVendorHours);
router.get("/vendors/me/dashboard", authenticate, requireRole(ROLES.VENDOR), getMyDashboard);
router.get(
  "/vendors/me/analytics", 
  authenticate, 
  requireRole(ROLES.VENDOR), 
  requirePlan("premium"), 
  getVendorAnalytics
);
router.get("/vendors/me/reviews", authenticate, requireRole(ROLES.VENDOR), getMyReviews);

// Daily Location (Location Broadcast) — must precede /vendors/:vendor_id
router.get("/vendors/me/daily-location", authenticate, requireRole(ROLES.VENDOR), getMyDailyLocation);
router.put(
  "/vendors/me/daily-location",
  authenticate,
  requireRole(ROLES.VENDOR),
  validate({ body: upsertDailyLocationSchema }),
  upsertDailyLocation,
);
router.delete("/vendors/me/daily-location", authenticate, requireRole(ROLES.VENDOR), removeDailyLocation);
router.get("/vendors/nearby/daily", optionalAuthenticate, validate({ query: nearbyVendorsQuerySchema }), nearbyDailyLocations);

router.get("/vendors/:vendor_id", validate({ params: vendorIdParamsSchema }), getVendorById);
router.get("/vendors/:vendor_id/location", validate({ params: vendorIdParamsSchema }), getVendorLocation);
router.get("/vendors/:vendor_id/daily-location", validate({ params: vendorIdParamsSchema }), getVendorDailyLocation);
router.post(
  "/vendors/:vendor_id/ring-bell",
  authenticate,
  validate({ params: vendorIdParamsSchema, body: ringBellSchema }),
  ringBell
);
router.post(
  "/vendors/:vendor_id/reviews",
  authenticate,
  requireRole(ROLES.CUSTOMER),
  validate({ params: vendorIdParamsSchema, body: createReviewSchema }),
  createVendorReview
);

// Admin routes
router.post(
  "/vendors/:vendor_id/review",
  authenticate,
  requirePermission(PERMISSIONS.VENDORS_APPROVE),
  validate({ params: vendorIdParamsSchema, body: vendorReviewSchema }),
  reviewVendor
);
router.post(
  "/vendors/:vendor_id/suspend",
  authenticate,
  requirePermission(PERMISSIONS.VENDORS_UPDATE),
  validate({ params: vendorIdParamsSchema }),
  suspendVendor
);

export default router;
