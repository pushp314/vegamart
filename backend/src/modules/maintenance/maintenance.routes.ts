import { Router } from "express";

import {
  getPublicMaintenanceStatus,
  quickDisableMaintenance,
  quickEnableMaintenance,
} from "./maintenance.controller";
import { maintenanceApiLimiter, requireToggleAccess } from "./maintenance.middleware";

const router = Router();

router.get("/maintenance/status", getPublicMaintenanceStatus);

const quickToggleRouter = Router();
quickToggleRouter.use(maintenanceApiLimiter, requireToggleAccess);
quickToggleRouter.get("/maintenance/on", quickEnableMaintenance);
quickToggleRouter.get("/maintenance/off", quickDisableMaintenance);

router.use(quickToggleRouter);

export default router;
