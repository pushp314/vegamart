import { Router } from "express";

import { createOrderFromCart, placeOrder, previewCheckout } from "../../controllers/checkout.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { apiLimiter } from "../../middlewares/rate-limit.middleware";
import { ROLES } from "../../constants/roles";
import { checkoutPreviewSchema, createOrderFromCartSchema, placeOrderSchema } from "../../validators/checkout.validators";

const router = Router();

router.post("/checkout/preview", apiLimiter, authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: checkoutPreviewSchema }), previewCheckout);
router.post("/checkout", apiLimiter, authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: placeOrderSchema }), placeOrder);
router.post("/orders", apiLimiter, authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: createOrderFromCartSchema }), createOrderFromCart);

export default router;
