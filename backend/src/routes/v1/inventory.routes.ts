import { Router } from "express";

import {
  adjustInventory,
  bulkUpdateInventory,
  getInventory,
  listInventory,
  setInventory,
} from "../../controllers/inventory.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import {
  adjustInventorySchema,
  bulkInventorySchema,
  inventoryParamsSchema,
  setInventorySchema,
} from "../../validators/inventory.validators";

const router = Router();

router.use(authenticate);

router.get("/", listInventory);
router.put("/bulk", validate({ body: bulkInventorySchema }), bulkUpdateInventory);
router.get("/:product_id", validate({ params: inventoryParamsSchema }), getInventory);
router.put("/:product_id", validate({ params: inventoryParamsSchema, body: setInventorySchema }), setInventory);
router.post("/:product_id/adjust", validate({ params: inventoryParamsSchema, body: adjustInventorySchema }), adjustInventory);

export default router;
