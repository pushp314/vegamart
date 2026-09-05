import { Router } from "express";

import {
  getMyStats,
  getMyEarnings,
  setAvailability,
  updateProfile,
  registerDelivery,
  applyDelivery,
  getDeliveryMe,
  listDeliveryRequests,
  listMyDeliveries,
  acceptDelivery,
  updateDeliveryStatus,
  notifyVendor,
  confirmPickup,
  updateDeliveryLocation,
  markDelivered,
  submitDeliveryKyc,
  getDeliveryTracking,
  getDeliveryWallet,
  requestDeliveryWithdrawal,
  updateDeliveryBankDetails,
  exportDeliveryWalletStatement,
  verifyDeliveryUpi,
  verifyDeliveryBank,
} from "../../controllers/delivery.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import { z } from "zod";
import {
  deliveryApplySchema,
  deliveryRegisterSchema,
  deliveryAcceptSchema,
  deliveryOrderStatusSchema,
  deliveryLocationSchema,
  deliveredOtpSchema,
  deliveryKycSchema,
  orderIdAliasParamsSchema,
} from "../../validators/integration.validators";

const router = Router();

const deliveryAvailabilitySchema = z.object({
  is_available: z.boolean(),
});

const deliveryProfileUpdateSchema = z.object({
  vehicle_type: z.string().trim().max(50).optional(),
  vehicle_number: z.string().trim().max(20).optional(),
  license_number: z.string().trim().max(30).optional(),
  base_delivery_fee: z.coerce.number().min(0).optional(),
  fee_per_km: z.coerce.number().min(0).optional(),
});

const deliveryEarningsQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "all"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
});

// Delivery partner self-service routes
router.get(
  "/delivery/me/stats",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  getMyStats
);

router.get(
  "/delivery/me/earnings",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate({ query: deliveryEarningsQuerySchema }),
  getMyEarnings
);

// Delivery Wallet & Payouts Hub
router.get("/delivery/me/wallet", authenticate, requireRole(ROLES.DELIVERY_PARTNER), getDeliveryWallet);
router.post("/delivery/me/withdrawals/request", authenticate, requireRole(ROLES.DELIVERY_PARTNER), requestDeliveryWithdrawal);
router.put("/delivery/me/bank-details", authenticate, requireRole(ROLES.DELIVERY_PARTNER), updateDeliveryBankDetails);
router.post("/delivery/me/verify-upi", authenticate, requireRole(ROLES.DELIVERY_PARTNER), verifyDeliveryUpi);
router.post("/delivery/me/verify-bank", authenticate, requireRole(ROLES.DELIVERY_PARTNER), verifyDeliveryBank);
router.get("/delivery/me/wallet/statement/export", authenticate, requireRole(ROLES.DELIVERY_PARTNER), exportDeliveryWalletStatement);

router.put(
  "/delivery/orders/:id/accept",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate({ params: orderIdAliasParamsSchema, body: deliveryAcceptSchema }),
  acceptDelivery
);

router.put(
  "/delivery/me/availability",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate({ body: deliveryAvailabilitySchema }),
  setAvailability
);

router.put(
  "/delivery/me/profile",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate({ body: deliveryProfileUpdateSchema }),
  updateProfile
);

// Delivery operations
router.post("/delivery/register", authenticate, validate({ body: deliveryRegisterSchema }), registerDelivery);
router.post("/delivery/apply", authenticate, validate({ body: deliveryApplySchema }), applyDelivery);
router.get("/delivery/me", authenticate, requireRole(ROLES.DELIVERY_PARTNER), getDeliveryMe);
router.get("/delivery/requests", authenticate, requireRole(ROLES.DELIVERY_PARTNER), listDeliveryRequests);
router.get("/delivery/my-deliveries", authenticate, requireRole(ROLES.DELIVERY_PARTNER), listMyDeliveries);
router.put(
  "/delivery/orders/:id/status",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate({ params: orderIdAliasParamsSchema, body: deliveryOrderStatusSchema }),
  updateDeliveryStatus
);

router.post(
  "/delivery/orders/:id/sub-orders/:subId/notify-vendor",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  notifyVendor
);

router.post(
  "/delivery/orders/:id/sub-orders/:subId/confirm-pickup",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  confirmPickup
);

router.put("/delivery/location", authenticate, requireRole(ROLES.DELIVERY_PARTNER), validate({ body: deliveryLocationSchema }), updateDeliveryLocation);
router.put(
  "/delivery/order/:id/delivered",
  authenticate,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate({ params: orderIdAliasParamsSchema, body: deliveredOtpSchema }),
  markDelivered
);
router.post("/delivery/me/kyc", authenticate, requireRole(ROLES.DELIVERY_PARTNER), validate({ body: deliveryKycSchema }), submitDeliveryKyc);
router.get("/delivery/order/:id/tracking", authenticate, validate({ params: orderIdAliasParamsSchema }), getDeliveryTracking);

export default router;
