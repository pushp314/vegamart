import { Router } from "express";

import { metricsSnapshot } from "../../controllers/metrics.controller";

const router = Router();

router.get("/metrics", metricsSnapshot);

export default router;
