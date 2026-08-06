import type { Request, Response } from "express";

import { sendSuccess } from "../../utils/ApiResponse";
import asyncHandler from "../../utils/asyncHandler";
import type { EnableMaintenanceDto, IssueDeveloperTokenDto, UpdateMaintenanceMessageDto } from "./maintenance.dto";
import { developerIdFromIdentity, maintenanceService } from "./maintenance.service";

/**
 * @swagger
 * /system/maintenance/status:
 *   get:
 *     summary: Public maintenance status
 *     description: Publicly readable maintenance flag and message. Used by clients to detect downtime without developer credentials.
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
 * /system/developer/token:
 *   post:
 *     summary: Issue developer control token
 *     description: Exchange the developer API key for a short-lived JWT used to authenticate maintenance control endpoints.
 *     tags: [Maintenance]
 *     security:
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apiKey]
 *             properties:
 *               apiKey:
 *                 type: string
 *                 example: "dev_apikey_..."
 *     responses:
 *       200:
 *         description: Token issued.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 */
export const issueDeveloperToken = asyncHandler(async (req: Request, res: Response) => {
  const { apiKey } = req.body as IssueDeveloperTokenDto;
  const audit = maintenanceService.extractAuditContext(req);
  const result = maintenanceService.issueDeveloperToken(apiKey, {
    developerId: "developer",
    method: "api_key",
    ip: audit.ip,
  });
  await maintenanceService.logAudit(
    "token_issued",
    "developer",
    audit,
    "Developer JWT issued."
  );
  sendSuccess(res, result);
});

/**
 * @swagger
 * /system/maintenance/enable:
 *   post:
 *     summary: Enable maintenance mode
 *     description: Turns on maintenance mode across the API. Requires developer authentication (Bearer token or X-API-Key).
 *     tags: [Maintenance]
 *     security:
 *       - developerBearer: []
 *       - developerApiKey: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Scheduled maintenance from 2 AM to 4 AM IST."
 *     responses:
 *       200:
 *         description: Maintenance enabled.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const enableMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const { message } = (req.body ?? {}) as EnableMaintenanceDto;
  const audit = maintenanceService.extractAuditContext(req);
  const updatedBy = req.maintenanceDeveloper ? developerIdFromIdentity(req.maintenanceDeveloper) : "developer";
  const state = await maintenanceService.enable({ message, updatedBy, audit });
  sendSuccess(res, state, { message: "Maintenance mode enabled." });
});

/**
 * @swagger
 * /system/maintenance/disable:
 *   post:
 *     summary: Disable maintenance mode
 *     description: Turns off maintenance mode across the API. Requires developer authentication.
 *     tags: [Maintenance]
 *     security:
 *       - developerBearer: []
 *       - developerApiKey: []
 *     responses:
 *       200:
 *         description: Maintenance disabled.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const disableMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const audit = maintenanceService.extractAuditContext(req);
  const updatedBy = req.maintenanceDeveloper ? developerIdFromIdentity(req.maintenanceDeveloper) : "developer";
  const result = await maintenanceService.disable({ updatedBy, audit });
  sendSuccess(res, result, { message: "Maintenance mode disabled." });
});

/**
 * @swagger
 * /system/maintenance/update:
 *   post:
 *     summary: Update maintenance message
 *     description: Update the maintenance banner message while maintenance mode stays enabled. Requires developer authentication.
 *     tags: [Maintenance]
 *     security:
 *       - developerBearer: []
 *       - developerApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Maintenance extended until 6 AM IST."
 *     responses:
 *       200:
 *         description: Message updated.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const updateMaintenanceMessage = asyncHandler(async (req: Request, res: Response) => {
  const { message } = req.body as UpdateMaintenanceMessageDto;
  const audit = maintenanceService.extractAuditContext(req);
  const updatedBy = req.maintenanceDeveloper ? developerIdFromIdentity(req.maintenanceDeveloper) : "developer";
  const state = await maintenanceService.updateMessage({ message, updatedBy, audit });
  sendSuccess(res, state, { message: "Maintenance message updated." });
});

/**
 * @swagger
 * /system/maintenance:
 *   get:
 *     summary: Get full maintenance state
 *     description: Full maintenance state including the last updater. Requires developer authentication.
 *     tags: [Maintenance]
 *     security:
 *       - developerBearer: []
 *       - developerApiKey: []
 *     responses:
 *       200:
 *         description: Full maintenance state.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const getMaintenanceStatus = asyncHandler(async (_req: Request, res: Response) => {
  const state = await maintenanceService.getFullState();
  sendSuccess(res, state);
});

/**
 * @swagger
 * /system/maintenance/audit-logs:
 *   get:
 *     summary: List maintenance audit logs
 *     description: Recent maintenance actions (enable/disable/update/token issuance). Requires developer authentication.
 *     tags: [Maintenance]
 *     security:
 *       - developerBearer: []
 *       - developerApiKey: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       200:
 *         description: Audit log entries.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const getMaintenanceAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 50);
  const logs = await maintenanceService.getAuditLogs(limit);
  sendSuccess(res, logs);
});
