import { Router } from "express";

import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../../controllers/cart.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import {
  addCartItemSchema,
  cartItemIdParamsSchema,
  updateCartItemSchema,
} from "../../validators/cart.validators";

const router = Router();

router.get("/cart", authenticate, requireRole(ROLES.CUSTOMER), getCart);
router.post("/cart/items", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: addCartItemSchema }), addCartItem);
router.patch("/cart/items/:item_id", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: cartItemIdParamsSchema, body: updateCartItemSchema }), updateCartItem);
router.delete("/cart/items/:item_id", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: cartItemIdParamsSchema }), removeCartItem);
router.delete("/cart", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), clearCart);

export default router;
