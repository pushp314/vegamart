import { Router } from "express";

import { placeOrder, previewCheckout } from "../../controllers/checkout.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import { checkoutPreviewSchema, placeOrderSchema } from "../../validators/checkout.validators";

const router = Router();

router.post("/checkout/preview", authenticate, requireRole(ROLES.CUSTOMER), validate({ body: checkoutPreviewSchema }), previewCheckout);
router.post("/checkout", authenticate, requireRole(ROLES.CUSTOMER), validate({ body: placeOrderSchema }), placeOrder);

export default router;
