import { Router } from "express";

import { validate } from "../../middlewares/validate";
import {
  disableMaintenance,
  enableMaintenance,
  getMaintenanceAuditLogs,
  getMaintenanceStatus,
  getPublicMaintenanceStatus,
  issueDeveloperToken,
  updateMaintenanceMessage,
} from "./maintenance.controller";
import {
  enableMaintenanceSchema,
  issueDeveloperTokenSchema,
  listAuditLogsSchema,
  updateMaintenanceMessageSchema,
} from "./maintenance.validator";
import { maintenanceApiLimiter, maintenanceAuthLimiter, requireDeveloper } from "./maintenance.middleware";

const router = Router();

router.get("/maintenance/status", getPublicMaintenanceStatus);

const developerRouter = Router();
developerRouter.post(
  "/developer/token",
  maintenanceAuthLimiter,
  validate({ body: issueDeveloperTokenSchema }),
  issueDeveloperToken
);

const protectedRouter = Router();
protectedRouter.use(maintenanceApiLimiter, requireDeveloper);

protectedRouter.post(
  "/maintenance/enable",
  validate({ body: enableMaintenanceSchema }),
  enableMaintenance
);
protectedRouter.post(
  "/maintenance/disable",
  disableMaintenance
);
protectedRouter.post(
  "/maintenance/update",
  validate({ body: updateMaintenanceMessageSchema }),
  updateMaintenanceMessage
);
protectedRouter.get("/maintenance", getMaintenanceStatus);
protectedRouter.get(
  "/maintenance/audit-logs",
  validate({ query: listAuditLogsSchema }),
  getMaintenanceAuditLogs
);

router.use(developerRouter);
router.use(protectedRouter);

export default router;
