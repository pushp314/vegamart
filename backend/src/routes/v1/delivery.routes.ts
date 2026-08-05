import { Router } from "express";

import {
  getMyStats,
  getMyEarnings,
  setAvailability,
  updateProfile,
} from "../../controllers/delivery.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import { z } from "zod";

const router = Router();

const deliveryAvailabilitySchema = z.object({
  is_available: z.boolean(),
});

const deliveryProfileUpdateSchema = z.object({
  vehicle_type: z.string().trim().max(50).optional(),
  vehicle_number: z.string().trim().max(20).optional(),
  license_number: z.string().trim().max(30).optional(),
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

export default router;
