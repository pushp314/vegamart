import type { Request } from "express";
import { Prisma } from "@prisma/client";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as reportsRepo from "../repositories/reports.repository";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import {
  contentDisposition,
  toCsv,
  toXlsx,
  toPdf,
  type ExportColumn,
  type ExportFormat,
} from "../utils/report-export";
import { parseDateParam } from "../utils/time";

export interface ReportDateRange {
  from: Date;
  to: Date;
}

export function resolveDateRange(params: {
  from?: string;
  to?: string;
  days?: string;
}): ReportDateRange {
  const now = new Date();

  if (params.from && params.to) {
    const from = parseDateParam(params.from, false);
    const to = parseDateParam(params.to, true);
    if (!from || !to) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid date range.", { code: "INVALID_DATE_RANGE" });
    }
    if (from >= to) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "`from` must be before `to`.", { code: "INVALID_DATE_RANGE" });
    }
    return { from, to };
  }

  const days = params.days ? Number(params.days) : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from, to: now };
}

export function resolvePeriod(period?: string): reportsRepo.ReportPeriod {
  if (period === "weekly" || period === "monthly" || period === "daily") {
    return period;
  }
  return "daily";
}

export function resolveExportFormat(format?: string): ExportFormat {
  if (format === "xlsx" || format === "pdf") {
    return format;
  }
  return "csv";
}

async function buildExport(
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  format: ExportFormat,
  title: string
): Promise<{ buffer: Buffer; contentType: string; disposition: string }> {
  const contentType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : format === "pdf"
        ? "application/pdf"
        : "text/csv; charset=utf-8";

  if (format === "xlsx") {
    return { buffer: await toXlsx(columns, rows), contentType, disposition: contentDisposition(title, "xlsx") };
  }
  if (format === "pdf") {
    return { buffer: await toPdf(columns, rows, title), contentType, disposition: contentDisposition(title, "pdf") };
  }
  return {
    buffer: Buffer.from(toCsv(columns, rows), "utf8"),
    contentType,
    disposition: contentDisposition(title, "csv"),
  };
}

function serializeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = value instanceof Prisma.Decimal ? value.toNumber() : value;
    }
    return out;
  });
}

export const reportService = {
  async revenue(range: ReportDateRange, period: reportsRepo.ReportPeriod, adminUserId: string, req: Request, format?: string) {
    const rows = await reportsRepo.revenueReport(range, period);
    const serialized = rows.map((r) => ({
      period_start: r.period_start.toISOString(),
      orders: r.orders,
      revenue: Number(r.revenue),
      avg_order_value: Number(r.avg_order_value),
    }));

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.REPORT_EXPORTED, entityType: "report", entityId: "revenue", newValues: { format: format ?? "json" } },
      req
    );

    if (format) {
      const columns: ExportColumn[] = [
        { key: "period_start", header: "Period Start" },
        { key: "orders", header: "Orders" },
        { key: "revenue", header: "Revenue" },
        { key: "avg_order_value", header: "Avg Order Value" },
      ];
      return buildExport(columns, serialized, resolveExportFormat(format), "revenue-report");
    }
    return serialized;
  },

  async vendors(range: ReportDateRange, adminUserId: string, req: Request, format?: string) {
    const rows = await reportsRepo.vendorReport(range);
    const serialized = rows.map((r) => ({
      vendor_id: r.vendor_id,
      business_name: r.business_name,
      city: r.city,
      status: r.status,
      orders: r.orders,
      revenue: Number(r.revenue),
      commission_rate: Number(r.commission_rate),
      commission_amount: Number(r.commission_amount),
      avg_order_value: Number(r.avg_order_value),
      products: r.products,
    }));

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.REPORT_EXPORTED, entityType: "report", entityId: "vendors", newValues: { format: format ?? "json" } },
      req
    );

    if (format) {
      const columns: ExportColumn[] = [
        { key: "vendor_id", header: "Vendor ID" },
        { key: "business_name", header: "Business Name" },
        { key: "city", header: "City" },
        { key: "status", header: "Status" },
        { key: "orders", header: "Orders" },
        { key: "revenue", header: "Revenue" },
        { key: "commission_rate", header: "Commission Rate (%)" },
        { key: "commission_amount", header: "Commission Amount (₹)" },
        { key: "avg_order_value", header: "Avg Order Value" },
        { key: "products", header: "Products" },
      ];
      return buildExport(columns, serialized, resolveExportFormat(format), "vendor-report");
    }
    return serialized;
  },

  async products(range: ReportDateRange, adminUserId: string, req: Request, format?: string, limit = 100) {
    const rows = await reportsRepo.productReport(range, limit);
    const serialized = rows.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      category: r.category,
      vendor_id: r.vendor_id,
      units_sold: r.units_sold,
      revenue: Number(r.revenue),
      avg_price: Number(r.avg_price),
    }));

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.REPORT_EXPORTED, entityType: "report", entityId: "products", newValues: { format: format ?? "json" } },
      req
    );

    if (format) {
      const columns: ExportColumn[] = [
        { key: "product_id", header: "Product ID" },
        { key: "product_name", header: "Product Name" },
        { key: "category", header: "Category" },
        { key: "vendor_id", header: "Vendor ID" },
        { key: "units_sold", header: "Units Sold" },
        { key: "revenue", header: "Revenue" },
        { key: "avg_price", header: "Avg Price" },
      ];
      return buildExport(columns, serialized, resolveExportFormat(format), "product-report");
    }
    return serialized;
  },

  async custom(
    range: ReportDateRange,
    groupBy: reportsRepo.CustomGroupBy,
    adminUserId: string,
    req: Request,
    format?: string
  ) {
    const rows = await reportsRepo.customReport(range, groupBy);
    const serialized = rows.map((r) => ({
      group_key: r.group_key,
      orders: r.orders,
      revenue: Number(r.revenue),
    }));

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.REPORT_EXPORTED, entityType: "report", entityId: `custom:${groupBy}`, newValues: { format: format ?? "json" } },
      req
    );

    if (format) {
      const columns: ExportColumn[] = [
        { key: "group_key", header: "Group" },
        { key: "orders", header: "Orders" },
        { key: "revenue", header: "Revenue" },
      ];
      return buildExport(columns, serialized, resolveExportFormat(format), "custom-report");
    }
    return serialized;
  },

  async orders(
    range: ReportDateRange,
    filter: { status?: string; paymentStatus?: string; paymentMethod?: string; q?: string },
    page: number,
    perPage: number,
    adminUserId: string,
    req: Request,
    format?: string
  ) {
    const { rows, total } = await reportsRepo.ordersReport(range, filter, (page - 1) * perPage, perPage);
    const serialized = serializeRows(rows as unknown as Array<Record<string, unknown>>);

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.REPORT_EXPORTED, entityType: "report", entityId: "orders", newValues: { format: format ?? "json" } },
      req
    );

    if (format) {
      const columns: ExportColumn[] = [
        { key: "order_number", header: "Order Number" },
        { key: "status", header: "Status" },
        { key: "payment_status", header: "Payment Status" },
        { key: "payment_method", header: "Payment Method" },
        { key: "total", header: "Total" },
        { key: "discount", header: "Discount" },
        { key: "tax", header: "Tax" },
        { key: "delivery_fee", header: "Delivery Fee" },
        { key: "customer_name", header: "Customer" },
        { key: "vendor_name", header: "Vendor" },
        { key: "city", header: "City" },
        { key: "created_at", header: "Created At" },
      ];
      return buildExport(columns, serialized, resolveExportFormat(format), "orders-report");
    }
    return { rows: serialized, total };
  },
};

export { serializeRows };
