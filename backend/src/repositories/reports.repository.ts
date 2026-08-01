import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export type ReportPeriod = "daily" | "weekly" | "monthly";

export interface DateRange {
  from: Date;
  to: Date;
}

function bucketFor(period: ReportPeriod): Prisma.Sql {
  switch (period) {
    case "weekly":
      return Prisma.sql`date_trunc('week', o."created_at")`;
    case "monthly":
      return Prisma.sql`date_trunc('month', o."created_at")`;
    default:
      return Prisma.sql`date_trunc('day', o."created_at")`;
  }
}

export interface RevenueReportRow {
  period_start: Date;
  orders: number;
  revenue: Prisma.Decimal;
  avg_order_value: Prisma.Decimal;
}

export async function revenueReport(range: DateRange, period: ReportPeriod): Promise<RevenueReportRow[]> {
  const rows = await prisma.$queryRaw<Array<{ period_start: Date; orders: bigint; revenue: Prisma.Decimal; avg_order_value: Prisma.Decimal }>>(
    Prisma.sql`
      SELECT
        ${bucketFor(period)} AS period_start,
        COUNT(*) AS orders,
        COALESCE(SUM(o."total"), 0) AS revenue,
        COALESCE(AVG(o."total"), 0) AS avg_order_value
      FROM orders o
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY ${bucketFor(period)}
      ORDER BY period_start ASC
    `
  );
  return rows.map((r) => ({
    period_start: r.period_start,
    orders: Number(r.orders),
    revenue: new Prisma.Decimal(r.revenue.toString()),
    avg_order_value: new Prisma.Decimal(r.avg_order_value.toString()),
  }));
}

export interface VendorReportRow {
  vendor_id: string;
  business_name: string;
  city: string;
  status: string;
  orders: number;
  revenue: Prisma.Decimal;
  avg_order_value: Prisma.Decimal;
  products: number;
}

export async function vendorReport(range: DateRange): Promise<VendorReportRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    vendor_id: string;
    business_name: string;
    city: string;
    status: string;
    orders: bigint;
    revenue: Prisma.Decimal;
    avg_order_value: Prisma.Decimal;
    products: bigint;
  }>>(
    Prisma.sql`
      SELECT
        v."id" AS vendor_id,
        v."business_name",
        v."city",
        v."status",
        COUNT(o."id") AS orders,
        COALESCE(SUM(o."total"), 0) AS revenue,
        COALESCE(AVG(o."total"), 0) AS avg_order_value,
        COUNT(p."id") AS products
      FROM vendor_profiles v
      LEFT JOIN orders o
        ON o."vendor_id" = v."id"
        AND o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      LEFT JOIN products p ON p."vendor_id" = v."id" AND p."deleted_at" IS NULL
      WHERE v."deleted_at" IS NULL
      GROUP BY v."id", v."business_name", v."city", v."status"
      ORDER BY revenue DESC
    `
  );
  return rows.map((r) => ({
    vendor_id: r.vendor_id,
    business_name: r.business_name,
    city: r.city,
    status: r.status,
    orders: Number(r.orders),
    revenue: new Prisma.Decimal(r.revenue.toString()),
    avg_order_value: new Prisma.Decimal(r.avg_order_value.toString()),
    products: Number(r.products),
  }));
}

export interface ProductReportRow {
  product_id: string;
  product_name: string;
  category: string;
  vendor_id: string;
  units_sold: number;
  revenue: Prisma.Decimal;
  avg_price: Prisma.Decimal;
}

export async function productReport(range: DateRange, limit = 100): Promise<ProductReportRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    product_id: string;
    product_name: string;
    category: string | null;
    vendor_id: string;
    units_sold: bigint;
    revenue: Prisma.Decimal;
    avg_price: Prisma.Decimal;
  }>>(
    Prisma.sql`
      SELECT
        oi."product_id",
        oi."product_name",
        c."name" AS category,
        o."vendor_id",
        SUM(oi."quantity") AS units_sold,
        SUM(oi."total_price") AS revenue,
        COALESCE(AVG(oi."unit_price"), 0) AS avg_price
      FROM order_items oi
      JOIN orders o ON o."id" = oi."order_id"
      LEFT JOIN products p ON p."id" = oi."product_id"
      LEFT JOIN categories c ON c."id" = p."category_id"
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY oi."product_id", oi."product_name", c."name", o."vendor_id"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `
  );
  return rows.map((r) => ({
    product_id: r.product_id,
    product_name: r.product_name,
    category: r.category ?? "",
    vendor_id: r.vendor_id,
    units_sold: Number(r.units_sold),
    revenue: new Prisma.Decimal(r.revenue.toString()),
    avg_price: new Prisma.Decimal(r.avg_price.toString()),
  }));
}

export interface CustomReportRow {
  group_key: string;
  orders: number;
  revenue: Prisma.Decimal;
}

export type CustomGroupBy =
  | "status"
  | "payment_method"
  | "payment_status"
  | "city"
  | "day"
  | "week"
  | "month";

export async function customReport(range: DateRange, groupBy: CustomGroupBy): Promise<CustomReportRow[]> {
  const groupExpr = (() => {
    switch (groupBy) {
      case "city":
        return Prisma.sql`COALESCE(a."city", 'Unknown')`;
      case "day":
        return Prisma.sql`to_char(date_trunc('day', o."created_at"), 'YYYY-MM-DD')`;
      case "week":
        return Prisma.sql`to_char(date_trunc('week', o."created_at"), 'YYYY-MM-DD')`;
      case "month":
        return Prisma.sql`to_char(date_trunc('month', o."created_at"), 'YYYY-MM')`;
      case "payment_method":
        return Prisma.sql`o."payment_method"`;
      case "payment_status":
        return Prisma.sql`o."payment_status"`;
      default:
        return Prisma.sql`o."status"`;
    }
  })();

  const rows = await prisma.$queryRaw<Array<{ group_key: string; orders: bigint; revenue: Prisma.Decimal }>>(
    Prisma.sql`
      SELECT
        ${groupExpr} AS group_key,
        COUNT(*) AS orders,
        COALESCE(SUM(o."total"), 0) AS revenue
      FROM orders o
      LEFT JOIN addresses a ON a."id" = o."address_id"
      WHERE o."created_at" >= ${range.from} AND o."created_at" < ${range.to}
        AND o."status" NOT IN ('CANCELLED', 'FAILED')
        AND o."deleted_at" IS NULL
      GROUP BY group_key
      ORDER BY revenue DESC
    `
  );
  return rows.map((r) => ({
    group_key: String(r.group_key),
    orders: Number(r.orders),
    revenue: new Prisma.Decimal(r.revenue.toString()),
  }));
}

export interface OrdersReportRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  delivery_fee: Prisma.Decimal;
  customer_name: string;
  vendor_name: string;
  city: string;
  created_at: Date;
}

export async function ordersReport(
  range: DateRange,
  filter: { status?: string; paymentStatus?: string; paymentMethod?: string; q?: string },
  skip: number,
  take: number
): Promise<{ rows: OrdersReportRow[]; total: number }> {
  const where: Prisma.OrderWhereInput = {
    created_at: { gte: range.from, lt: range.to },
    deleted_at: null,
  };
  if (filter.status) where.status = filter.status as Prisma.OrderWhereInput["status"];
  if (filter.paymentStatus) where.payment_status = filter.paymentStatus as Prisma.OrderWhereInput["payment_status"];
  if (filter.paymentMethod) where.payment_method = filter.paymentMethod as Prisma.OrderWhereInput["payment_method"];
  if (filter.q) {
    where.OR = [
      { order_number: { contains: filter.q, mode: "insensitive" } },
      { customer: { name: { contains: filter.q, mode: "insensitive" } } },
      { vendor: { business_name: { contains: filter.q, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: {
        id: true,
        order_number: true,
        status: true,
        payment_status: true,
        payment_method: true,
        total: true,
        discount: true,
        tax: true,
        delivery_fee: true,
        created_at: true,
        customer: { select: { name: true } },
        vendor: { select: { business_name: true } },
        address: { select: { city: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      order_number: r.order_number,
      status: r.status,
      payment_status: r.payment_status,
      payment_method: r.payment_method,
      total: r.total,
      discount: r.discount,
      tax: r.tax,
      delivery_fee: r.delivery_fee,
      customer_name: r.customer.name,
      vendor_name: r.vendor.business_name,
      city: r.address.city,
      created_at: r.created_at,
    })),
    total,
  };
}
