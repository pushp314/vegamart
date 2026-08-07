import { Router } from "express";

import {
  getPublicMaintenanceStatus,
  quickDisableMaintenance,
  quickEnableMaintenance,
} from "./maintenance.controller";
import { maintenanceApiLimiter, requireLoopback } from "./maintenance.middleware";

const router = Router();

router.get("/maintenance/status", getPublicMaintenanceStatus);

const quickToggleRouter = Router();
quickToggleRouter.use(maintenanceApiLimiter, requireLoopback);
quickToggleRouter.post("/maintenance/on", quickEnableMaintenance);
quickToggleRouter.post("/maintenance/off", quickDisableMaintenance);

router.use(quickToggleRouter);

export default router;
