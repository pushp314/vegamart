import { Router } from "express";

import {
  addWishlistItem,
  getWishlist,
  removeWishlistItem,
} from "../../controllers/wishlist.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import {
  addWishlistItemSchema,
  wishlistProductParamsSchema,
} from "../../validators/wishlist.validators";

const router = Router();

router.get("/wishlist", authenticate, requireRole(ROLES.CUSTOMER), getWishlist);
router.post("/wishlist", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: addWishlistItemSchema }), addWishlistItem);
router.delete("/wishlist/:product_id", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: wishlistProductParamsSchema }), removeWishlistItem);

export default router;
