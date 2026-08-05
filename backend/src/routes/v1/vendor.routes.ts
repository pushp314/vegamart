import { Router } from "express";

import {
  createVendor,
  getMyDashboard,
  getMyDailyLocation,
  getMyLocation,
  getMyVendor,
  getVendorById,
  getVendorBySlug,
  getVendorDailyLocation,
  getVendorLocation,
  listVendors,
  nearbyDailyLocations,
  nearbyVendors,
  patchVendorLocation,
  removeDailyLocation,
  reviewVendor,
  setVendorAvailability,
  suspendVendor,
  updateMyVendor,
  updateVendorHours,
  updateVendorLocation,
  upsertDailyLocation,
} from "../../controllers/vendor.controller";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS, ROLES } from "../../constants/roles";
import {
  createVendorSchema,
  listVendorsQuerySchema,
  nearbyVendorsQuerySchema,
  upsertDailyLocationSchema,
  updateVendorSchema,
  vendorAvailabilitySchema,
  vendorHoursSchema,
  vendorIdParamsSchema,
  vendorLocationSchema,
  vendorLocationUpdateSchema,
  vendorReviewSchema,
  vendorSlugParamsSchema,
} from "../../validators/vendor.validators";

const router = Router();

// Public routes
router.get("/vendors", validate({ query: listVendorsQuerySchema }), listVendors);
router.get("/vendors/nearby", validate({ query: nearbyVendorsQuerySchema }), nearbyVendors);
router.get("/vendors/by-slug/:slug", validate({ params: vendorSlugParamsSchema }), getVendorBySlug);

// Vendor self-service (must precede /vendors/:vendor_id)
router.get("/vendors/me", authenticate, getMyVendor);
router.post("/vendors", authenticate, requireRole(ROLES.VENDOR), validate({ body: createVendorSchema }), createVendor);
router.put("/vendors/me", authenticate, validate({ body: updateVendorSchema }), updateMyVendor);
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
router.put("/vendors/me/hours", authenticate, validate({ body: vendorHoursSchema }), updateVendorHours);
router.get("/vendors/me/dashboard", authenticate, requireRole(ROLES.VENDOR), getMyDashboard);

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
router.get("/vendors/nearby/daily", validate({ query: nearbyVendorsQuerySchema }), nearbyDailyLocations);

router.get("/vendors/:vendor_id", validate({ params: vendorIdParamsSchema }), getVendorById);
router.get("/vendors/:vendor_id/location", validate({ params: vendorIdParamsSchema }), getVendorLocation);
router.get("/vendors/:vendor_id/daily-location", validate({ params: vendorIdParamsSchema }), getVendorDailyLocation);

// Admin routes
router.post(
  "/vendors/:vendor_id/review",
  requirePermission(PERMISSIONS.VENDORS_APPROVE),
  validate({ params: vendorIdParamsSchema, body: vendorReviewSchema }),
  reviewVendor
);
router.post(
  "/vendors/:vendor_id/suspend",
  requirePermission(PERMISSIONS.VENDORS_UPDATE),
  validate({ params: vendorIdParamsSchema }),
  suspendVendor
);

export default router;
