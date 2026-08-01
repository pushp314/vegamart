import { Router } from "express";

import {
  healthAll,
  healthCheck,
  healthDatabase,
  healthEmail,
  healthPayment,
  healthRedis,
  healthStorage,
  healthSystem,
} from "../../controllers/health.controller";

const router = Router();

router.get("/health", healthCheck);
router.get("/health/db", healthDatabase);
router.get("/health/database", healthDatabase);
router.get("/health/redis", healthRedis);
router.get("/health/storage", healthStorage);
router.get("/health/payment", healthPayment);
router.get("/health/email", healthEmail);
router.get("/health/system", healthSystem);
router.get("/health/all", healthAll);

export default router;
