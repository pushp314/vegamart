import type { Request, Response } from "express";

import { collectMetricsSnapshot } from "../monitoring/metrics";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Application metrics snapshot
 *     description: Returns request, response-time, database, cache and system metrics.
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics snapshot.
 */
export const metricsSnapshot = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, collectMetricsSnapshot());
});
