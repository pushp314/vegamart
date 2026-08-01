import { Router } from "express";

import {
  createVendor,
  getMyLocation,
  getMyVendor,
  getVendorById,
  getVendorBySlug,
  getVendorLocation,
  listVendors,
  nearbyVendors,
  patchVendorLocation,
  reviewVendor,
  setVendorAvailability,
  suspendVendor,
  updateMyVendor,
  updateVendorHours,
  updateVendorLocation,
} from "../../controllers/vendor.controller";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS, ROLES } from "../../constants/roles";
import {
  createVendorSchema,
  listVendorsQuerySchema,
  nearbyVendorsQuerySchema,
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

router.get("/vendors/:vendor_id", validate({ params: vendorIdParamsSchema }), getVendorById);
router.get("/vendors/:vendor_id/location", validate({ params: vendorIdParamsSchema }), getVendorLocation);

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
