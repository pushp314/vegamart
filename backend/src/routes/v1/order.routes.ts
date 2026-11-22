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
  requestRefund,
  rejectOrderItem,
  updateDeliveryInstructions,
  assignShopRider,
  getVendorRiders,
  addVendorRider,
  deleteVendorRider,
  updatePickupPoint,
} from "../../controllers/order.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import {
  cancelOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  transitionOrderStatusSchema,
  requestRefundSchema,
  updateDeliveryInstructionsSchema,
  assignShopRiderSchema,
  saveInHouseRiderSchema,
  updatePickupPointSchema,
} from "../../validators/order.validators";

const router = Router();

// Customer order views
router.get("/orders", authenticate, requireRole(ROLES.CUSTOMER), validate({ query: listOrdersQuerySchema }), listMyOrders);
router.get("/orders/:order_id", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), getOrder);
router.get("/orders/:order_id/timeline", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), getOrderTimeline);
router.get("/orders/:order_id/invoice", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema }), getOrderInvoice);
router.post("/orders/:order_id/cancel", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema, body: cancelOrderSchema }), cancelOrder);
router.post("/orders/:order_id/refund", authenticate, blockGuest, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema, body: requestRefundSchema }), requestRefund);
router.patch("/orders/:order_id/instructions", authenticate, requireRole(ROLES.CUSTOMER), validate({ params: orderIdParamsSchema, body: updateDeliveryInstructionsSchema }), updateDeliveryInstructions);

// Vendor order views (must be registered before any catch-all order routes if present)
router.get("/vendors/orders", authenticate, requireRole(ROLES.VENDOR), validate({ query: listOrdersQuerySchema }), listVendorOrders);
router.get("/vendors/orders/:order_id", authenticate, requireRole(ROLES.VENDOR), validate({ params: orderIdParamsSchema }), getVendorOrder);
router.patch("/vendors/orders/:order_id/status", authenticate, requireRole(ROLES.VENDOR), validate({ params: orderIdParamsSchema, body: transitionOrderStatusSchema }), transitionOrderStatus);
router.post("/vendors/orders/:order_id/items/:item_id/reject", authenticate, requireRole(ROLES.VENDOR), rejectOrderItem);
router.post("/vendors/orders/:order_id/assign-rider", authenticate, requireRole(ROLES.VENDOR), validate({ params: orderIdParamsSchema, body: assignShopRiderSchema }), assignShopRider);
router.get("/vendors/me/riders", authenticate, requireRole(ROLES.VENDOR), getVendorRiders);
router.post("/vendors/me/riders", authenticate, requireRole(ROLES.VENDOR), validate({ body: saveInHouseRiderSchema }), addVendorRider);
router.delete("/vendors/me/riders/:rider_id", authenticate, requireRole(ROLES.VENDOR), deleteVendorRider);
router.put("/vendors/me/pickup-point", authenticate, requireRole(ROLES.VENDOR), validate({ body: updatePickupPointSchema }), updatePickupPoint);

export default router;
