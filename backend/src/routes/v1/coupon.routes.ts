import { Router } from "express";

import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  validateCoupon,
} from "../../controllers/coupon.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
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

// Customer: validate a code against the cart
router.post("/coupons/validate", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: validateCouponSchema }), validateCoupon);

// Admin-only coupon management
router.get("/coupons", authenticate, requirePermission(PERMISSIONS.COUPONS_READ), validate({ query: listCouponsQuerySchema }), listCoupons);
router.post("/coupons", authenticate, requirePermission(PERMISSIONS.COUPONS_CREATE), validate({ body: createCouponSchema }), createCoupon);
router.patch("/coupons/:coupon_id", authenticate, requirePermission(PERMISSIONS.COUPONS_UPDATE), validate({ params: couponIdParamsSchema, body: updateCouponSchema }), updateCoupon);
router.delete("/coupons/:coupon_id", authenticate, requirePermission(PERMISSIONS.COUPONS_DELETE), validate({ params: couponIdParamsSchema }), deleteCoupon);

export default router;
