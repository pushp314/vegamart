import { Router } from "express";

import {
  createCoupon,
  createVendorCoupon,
  deleteCoupon,
  deleteVendorCoupon,
  listCoupons,
  listAvailableCoupons,
  listVendorCoupons,
  updateCoupon,
  updateVendorCoupon,
  validateCoupon,
} from "../../controllers/coupon.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
import { requirePlan } from "../../middlewares/subscription.middleware";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS, ROLES } from "../../constants/roles";
import {
  couponIdParamsSchema,
  createCouponSchema,
  listCouponsQuerySchema,
  updateCouponSchema,
  validateCouponSchema,
} from "../../validators/coupon.validators";

const router = Router();

// Customer: view available active coupons
router.get("/coupons/available", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), listAvailableCoupons);

// Customer: validate a code against the cart
router.post("/coupons/validate", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: validateCouponSchema }), validateCoupon);

// Admin-only coupon management
router.get("/coupons", authenticate, requirePermission(PERMISSIONS.COUPONS_READ), validate({ query: listCouponsQuerySchema }), listCoupons);
router.post("/coupons", authenticate, requirePermission(PERMISSIONS.COUPONS_CREATE), validate({ body: createCouponSchema }), createCoupon);
router.patch("/coupons/:coupon_id", authenticate, requirePermission(PERMISSIONS.COUPONS_UPDATE), validate({ params: couponIdParamsSchema, body: updateCouponSchema }), updateCoupon);
router.delete("/coupons/:coupon_id", authenticate, requirePermission(PERMISSIONS.COUPONS_DELETE), validate({ params: couponIdParamsSchema }), deleteCoupon);

// Vendor coupon management (Business Tier) — scoped to the vendor's own coupons
router.get(
  "/vendors/me/coupons",
  authenticate,
  requireRole(ROLES.VENDOR),
  requirePlan("business"),
  validate({ query: listCouponsQuerySchema }),
  listVendorCoupons
);
router.post(
  "/vendors/me/coupons",
  authenticate,
  requireRole(ROLES.VENDOR),
  requirePlan("business"),
  validate({ body: createCouponSchema }),
  createVendorCoupon
);
router.patch(
  "/vendors/me/coupons/:coupon_id",
  authenticate,
  requireRole(ROLES.VENDOR),
  requirePlan("business"),
  validate({ params: couponIdParamsSchema, body: updateCouponSchema }),
  updateVendorCoupon
);
router.delete(
  "/vendors/me/coupons/:coupon_id",
  authenticate,
  requireRole(ROLES.VENDOR),
  requirePlan("business"),
  validate({ params: couponIdParamsSchema }),
  deleteVendorCoupon
);

export default router;
