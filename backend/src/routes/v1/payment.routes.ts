import { Router } from "express";

import {
  razorpayWebhook,
  refundPayment,
  verifyPayment,
  retryOrderPayment,
  switchOrderToCod,
  recordOrderPaymentFailure,
} from "../../controllers/payment.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requirePermission, requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS, ROLES } from "../../constants/roles";
import {
  orderIdParamsSchema,
  refundPaymentSchema,
  verifyPaymentSchema,
} from "../../validators/payment.validators";

const router = Router();

router.post("/payments/verify", authenticate, requireRole(ROLES.CUSTOMER), validate({ body: verifyPaymentSchema }), verifyPayment);
router.post("/payments/webhook", razorpayWebhook);
router.post("/payments/:order_id/refund", authenticate, requirePermission(PERMISSIONS.PAYMENTS_REFUND), validate({ params: orderIdParamsSchema, body: refundPaymentSchema }), refundPayment);
router.post("/payments/:order_id/retry", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), retryOrderPayment);
router.post("/payments/:order_id/switch-to-cod", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), switchOrderToCod);
router.post("/payments/:order_id/record-failure", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), recordOrderPaymentFailure);

export default router;
