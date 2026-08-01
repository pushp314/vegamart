import type { Request, Response } from "express";

import { reportService, resolveDateRange, resolvePeriod } from "../services/report.service";
import { analyticsService } from "../services/analytics.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";

type ExportResult = { buffer: Buffer; contentType: string; disposition: string };

function isExportResult(data: unknown): data is ExportResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "buffer" in data &&
    "contentType" in data &&
    "disposition" in data
  );
}

function sendFile(res: Response, result: ExportResult) {
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Disposition", result.disposition);
  return res.send(result.buffer);
}

/**
 * @swagger
 * /admin/reports/revenue:
 *   get:
 *     summary: Revenue report grouped by day/week/month
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: days
 *         schema: { type: integer }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [daily, weekly, monthly] }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       200:
 *         description: Revenue report (JSON rows or file download).
 */
export const revenueReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { from?: string; to?: string; days?: string; period?: string; format?: string };
  const range = resolveDateRange(query);
  const period = resolvePeriod(query.period);
  const data = await reportService.revenue(range, period, req.user!.id, req, query.format);
  if (isExportResult(data)) return sendFile(res, data);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/reports/vendors:
 *   get:
 *     summary: Vendor performance report
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: days
 *         schema: { type: integer }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       200:
 *         description: Vendor report.
 */
export const vendorsReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { from?: string; to?: string; days?: string; format?: string };
  const range = resolveDateRange(query);
  const data = await reportService.vendors(range, req.user!.id, req, query.format);
  if (isExportResult(data)) return sendFile(res, data);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/reports/products:
 *   get:
 *     summary: Product sales report
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: days
 *         schema: { type: integer }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       200:
 *         description: Product report.
 */
export const productsReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { from?: string; to?: string; days?: string; format?: string };
  const range = resolveDateRange(query);
  const data = await reportService.products(range, req.user!.id, req, query.format);
  if (isExportResult(data)) return sendFile(res, data);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/reports/custom:
 *   get:
 *     summary: Custom report grouped by a dimension
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: days
 *         schema: { type: integer }
 *       - in: query
 *         name: group_by
 *         schema: { type: string, enum: [status, payment_method, payment_status, city, day, week, month] }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       200:
 *         description: Custom report.
 */
export const customReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { from?: string; to?: string; days?: string; group_by?: string; format?: string };
  const range = resolveDateRange(query);
  const groupBy = (query.group_by ?? "status") as "status" | "payment_method" | "payment_status" | "city" | "day" | "week" | "month";
  const data = await reportService.custom(range, groupBy, req.user!.id, req, query.format);
  if (isExportResult(data)) return sendFile(res, data);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/reports/orders:
 *   get:
 *     summary: Order report with filters
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: days
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: payment_status
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       200:
 *         description: Order report.
 */
export const ordersReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const range = resolveDateRange(query);
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.per_page) || 20));
  const data = await reportService.orders(
    range,
    {
      status: query.status,
      paymentStatus: query.payment_status,
      paymentMethod: query.payment_method,
      q: query.q,
    },
    page,
    perPage,
    req.user!.id,
    req,
    query.format
  );
  if (isExportResult(data)) return sendFile(res, data);
  return sendSuccess(res, data.rows, {
    pagination: buildPaginationMeta({ page, per_page: perPage }, data.total),
  });
});

/**
 * @swagger
 * /admin/analytics/top-products:
 *   get:
 *     summary: Top products by revenue
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Top products.
 */
export const analyticsTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.topProducts(req.query as never, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/analytics/top-vendors:
 *   get:
 *     summary: Top vendors by revenue
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Top vendors.
 */
export const analyticsTopVendors = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.topVendors(req.query as never, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/analytics/top-customers:
 *   get:
 *     summary: Top customers by spend
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Top customers.
 */
export const analyticsTopCustomers = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.topCustomers(req.query as never, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/analytics/category-sales:
 *   get:
 *     summary: Sales by category
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Category sales.
 */
export const analyticsCategorySales = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.categorySales(req.query as never, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/analytics/trends:
 *   get:
 *     summary: Daily order and revenue trends
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Trends series.
 */
export const analyticsTrends = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.trends(req.query as never, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/analytics/growth:
 *   get:
 *     summary: Period-over-period growth
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Growth metrics.
 */
export const analyticsGrowth = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.growth(req.query as never, req);
  return sendSuccess(res, data);
});
