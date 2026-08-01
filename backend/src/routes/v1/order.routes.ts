import { Router } from "express";

import {
  cancelOrder,
  getOrder,
  getOrderInvoice,
  getOrderTimeline,
  getVendorOrder,
  listMyOrders,
  listVendorOrders,
  transitionOrderStatus,
} from "../../controllers/order.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import {
  cancelOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  transitionOrderStatusSchema,
} from "../../validators/order.validators";

const router = Router();

// Customer order views
router.get("/orders", authenticate, requireRole(ROLES.CUSTOMER), validate({ query: listOrdersQuerySchema }), listMyOrders);
router.get("/orders/:order_id", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), getOrder);
router.get("/orders/:order_id/timeline", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), getOrderTimeline);
router.get("/orders/:order_id/invoice", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), getOrderInvoice);
router.post("/orders/:order_id/cancel", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema, body: cancelOrderSchema }), cancelOrder);

// Vendor order views (must be registered before any catch-all order routes if present)
router.get("/vendors/orders", authenticate, requireRole(ROLES.VENDOR), validate({ query: listOrdersQuerySchema }), listVendorOrders);
router.get("/vendors/orders/:order_id", authenticate, requireRole(ROLES.VENDOR), validate({ params: orderIdParamsSchema }), getVendorOrder);
router.patch("/vendors/orders/:order_id/status", authenticate, requireRole(ROLES.VENDOR), validate({ params: orderIdParamsSchema, body: transitionOrderStatusSchema }), transitionOrderStatus);

export default router;
