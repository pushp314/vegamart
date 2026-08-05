import { Router } from "express";

import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "../../controllers/address.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import {
  addressIdParamsSchema,
  createAddressSchema,
  updateAddressSchema,
} from "../../validators/address.validators";

const router = Router();

router.get("/addresses", authenticate, requireRole(ROLES.CUSTOMER), listAddresses);
router.post("/addresses", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ body: createAddressSchema }), createAddress);
router.patch("/addresses/:address_id", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: addressIdParamsSchema, body: updateAddressSchema }), updateAddress);
router.delete("/addresses/:address_id", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: addressIdParamsSchema }), deleteAddress);
router.put("/addresses/:address_id/default", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: addressIdParamsSchema }), setDefaultAddress);

export default router;
