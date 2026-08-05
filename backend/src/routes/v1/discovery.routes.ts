import { Router } from "express";

import {
  clearSearchHistory,
  getFollowStatus,
  getVendorHistory,
  listFavorites,
  listFollows,
  listSearchHistory,
  toggleFavorite,
  toggleFollow,
} from "../../controllers/discovery.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { z } from "zod";
import { vendorIdParamsSchema } from "../../validators/vendor.validators";

const router = Router();

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Public
router.get(
  "/vendors/:vendor_id/history",
  validate({ params: vendorIdParamsSchema, query: historyQuerySchema }),
  getVendorHistory,
);

// Authenticated
router.post(
  "/discovery/favorites/:vendor_id",
  authenticate,
  validate({ params: vendorIdParamsSchema }),
  toggleFavorite,
);
router.get("/discovery/favorites", authenticate, listFavorites);
router.post(
  "/discovery/follows/:vendor_id",
  authenticate,
  validate({ params: vendorIdParamsSchema }),
  toggleFollow,
);
router.get("/discovery/follows", authenticate, listFollows);
router.get(
  "/discovery/follows/:vendor_id/status",
  authenticate,
  validate({ params: vendorIdParamsSchema }),
  getFollowStatus,
);
router.get("/discovery/search-history", authenticate, listSearchHistory);
router.delete("/discovery/search-history", authenticate, clearSearchHistory);

export default router;
