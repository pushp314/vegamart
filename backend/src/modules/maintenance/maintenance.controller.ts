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
 *   get:
 *     summary: Enable maintenance mode (browser link)
 *     description: Turns on maintenance mode with the "Contact the developer" message. Pasteable browser link. Requires ?token=<MAINTENANCE_TOGGLE_TOKEN> when a toggle token is configured; otherwise only reachable from the server (loopback).
 *     tags: [Maintenance]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Toggle token matching MAINTENANCE_TOGGLE_TOKEN (required when configured).
 *     responses:
 *       200:
 *         description: Maintenance enabled.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
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
 *   get:
 *     summary: Disable maintenance mode (browser link)
 *     description: Turns off maintenance mode. Pasteable browser link. Requires ?token=<MAINTENANCE_TOGGLE_TOKEN> when a toggle token is configured; otherwise only reachable from the server (loopback).
 *     tags: [Maintenance]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Toggle token matching MAINTENANCE_TOGGLE_TOKEN (required when configured).
 *     responses:
 *       200:
 *         description: Maintenance disabled.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
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
