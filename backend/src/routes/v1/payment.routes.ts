import { Router } from "express";

import {
  razorpayWebhook,
  refundPayment,
  verifyPayment,
  retryOrderPayment,
  switchOrderToCod,
  recordOrderPaymentFailure,
  initiateCheckoutPayment,
  verifyAndCreateOrder,
} from "../../controllers/payment.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { apiLimiter } from "../../middlewares/rate-limit.middleware";
import { PERMISSIONS, ROLES } from "../../constants/roles";
import {
  orderIdParamsSchema,
  refundPaymentSchema,
  verifyPaymentSchema,
  initiateCheckoutPaymentSchema,
  verifyAndCreateOrderSchema,
} from "../../validators/payment.validators";

const router = Router();

// Online Payment Checkout Flow (Order ONLY created after verified payment)
router.post(
  "/payments/initiate-checkout",
  apiLimiter,
  authenticate,
  blockGuest,
  requireRole(ROLES.CUSTOMER),
  validate({ body: initiateCheckoutPaymentSchema }),
  initiateCheckoutPayment
);

router.post(
  "/payments/verify-and-create-order",
  apiLimiter,
  authenticate,
  blockGuest,
  requireRole(ROLES.CUSTOMER),
  validate({ body: verifyAndCreateOrderSchema }),
  verifyAndCreateOrder
);

// Existing Payment Endpoints
router.post("/payments/verify", authenticate, requireRole(ROLES.CUSTOMER), validate({ body: verifyPaymentSchema }), verifyPayment);
router.post("/payments/webhook", razorpayWebhook);
router.post("/payments/:order_id/refund", authenticate, requirePermission(PERMISSIONS.PAYMENTS_REFUND), validate({ params: orderIdParamsSchema, body: refundPaymentSchema }), refundPayment);
router.post("/payments/:order_id/retry", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), retryOrderPayment);
router.post("/payments/:order_id/switch-to-cod", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), switchOrderToCod);
router.post("/payments/:order_id/record-failure", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), recordOrderPaymentFailure);

export default router;
