import type { Request, Response } from "express";

import { sendSuccess } from "../../utils/ApiResponse";
import asyncHandler from "../../utils/asyncHandler";
import { maintenanceService } from "./maintenance.service";

/**
 * @swagger
 * /system/maintenance/status:
 *   get:
 *     summary: Public maintenance status
 *     description: Publicly readable maintenance flag and message. Used by clients to detect downtime.
 *     tags: [Maintenance]
 *     responses:
 *       200:
 *         description: Maintenance status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     maintenance:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *                       nullable: true
 */
export const getPublicMaintenanceStatus = asyncHandler(async (_req: Request, res: Response) => {
  const status = await maintenanceService.getPublicStatus();
  sendSuccess(res, status);
});

/**
 * @swagger
 * /system/maintenance/on:
 *   post:
 *     summary: Enable maintenance mode (localhost only)
 *     description: Turns on maintenance mode with the "Contact the developer" message. Only reachable from the server itself (loopback); no API key required.
 *     tags: [Maintenance]
 *     responses:
 *       200:
 *         description: Maintenance enabled.
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 */
export const quickEnableMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const audit = maintenanceService.extractAuditContext(req);
  const state = await maintenanceService.enable({
    message: "Contact the developer",
    updatedBy: "local:operator",
    audit,
  });
  sendSuccess(res, state, { message: "Maintenance mode enabled." });
});

/**
 * @swagger
 * /system/maintenance/off:
 *   post:
 *     summary: Disable maintenance mode (localhost only)
 *     description: Turns off maintenance mode. Only reachable from the server itself (loopback); no API key required.
 *     tags: [Maintenance]
 *     responses:
 *       200:
 *         description: Maintenance disabled.
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 */
export const quickDisableMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const audit = maintenanceService.extractAuditContext(req);
  const result = await maintenanceService.disable({
    updatedBy: "local:operator",
    audit,
  });
  sendSuccess(res, result, { message: "Maintenance mode disabled." });
});
