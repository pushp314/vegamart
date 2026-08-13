import { Prisma } from "@prisma/client";

import { reportService, resolveDateRange } from "../../src/services/report.service";
jest.mock("../../src/repositories/reports.repository", () => ({
  revenueReport: jest.fn(),
  vendorReport: jest.fn(),
  productReport: jest.fn(),
  customReport: jest.fn(),
  ordersReport: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as reportsRepo from "../../src/repositories/reports.repository";

const repo = reportsRepo as jest.Mocked<typeof reportsRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

describe("report service — revenue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns JSON revenue rows for a date range", async () => {
    repo.revenueReport.mockResolvedValue([
      {
        period_start: new Date("2026-07-01T00:00:00Z"),
        orders: 3,
        revenue: new Prisma.Decimal(450),
        avg_order_value: new Prisma.Decimal(150),
      },
    ]);

    const result = await reportService.revenue(
      { from: new Date("2026-07-01"), to: new Date("2026-07-31") },
      "daily",
      "admin-1",
      mockReq
    );

    expect(repo.revenueReport).toHaveBeenCalledWith(
      { from: new Date("2026-07-01"), to: new Date("2026-07-31") },
      "daily"
    );
    expect(result).toEqual([
      {
        period_start: "2026-07-01T00:00:00.000Z",
        orders: 3,
        revenue: 450,
        avg_order_value: 150,
      },
    ]);
  });

  it("returns a CSV buffer when format is requested", async () => {
    repo.revenueReport.mockResolvedValue([
      {
        period_start: new Date("2026-07-01T00:00:00Z"),
        orders: 2,
        revenue: new Prisma.Decimal(200),
        avg_order_value: new Prisma.Decimal(100),
      },
    ]);

    const result = await reportService.revenue(
      { from: new Date("2026-07-01"), to: new Date("2026-07-02") },
      "daily",
      "admin-1",
      mockReq,
      "csv"
    );

    expect(result).toMatchObject({ contentType: "text/csv; charset=utf-8" });
    const csv = (result as { buffer: Buffer }).buffer.toString("utf8");
    expect(csv).toContain("Period Start");
    expect(csv).toContain("2026-07-01T00:00:00.000Z");
    expect(csv).toContain("200");
  });
});

describe("report service — orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("paginates and serializes order report rows", async () => {
    repo.ordersReport.mockResolvedValue({
      rows: [
        {
          id: "o1",
          order_number: "GC-1",
          status: "DELIVERED",
          payment_status: "PAID",
          payment_method: "razorpay",
          total: new Prisma.Decimal(250),
          discount: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(10),
          delivery_fee: new Prisma.Decimal(30),
          customer_name: "Amit",
          vendor_name: "Sharma Store",
          city: "Delhi",
          created_at: new Date("2026-07-01T00:00:00Z"),
        },
      ],
      total: 1,
    });

    const result = await reportService.orders(
      { from: new Date("2026-07-01"), to: new Date("2026-07-31") },
      { status: "DELIVERED" },
      1,
      20,
      "admin-1",
      mockReq
    );

    const data = result as { rows: Record<string, unknown>[]; total: number };
    expect(data.total).toBe(1);
    expect(data.rows[0]).toEqual(expect.objectContaining({ total: 250, order_number: "GC-1" }));
  });
});

describe("resolveDateRange", () => {
  it("treats date-only bounds as whole local calendar days and allows a single-day range", () => {
    const range = resolveDateRange({ from: "2026-08-13", to: "2026-08-13" });

    // from = local midnight, to = local 23:59:59.999 of the same day
    expect(range.from.getHours()).toBe(0);
    expect(range.from.getMinutes()).toBe(0);
    expect(range.to.getHours()).toBe(23);
    expect(range.to.getMinutes()).toBe(59);
    expect(range.to.getSeconds()).toBe(59);
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000 - 1);
  });

  it("normalises an explicit UTC-midnight `to` so the whole end day is included", () => {
    const range = resolveDateRange({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-13T00:00:00.000Z",
    });

    // from is kept as-is; to is pushed to 23:59:59.999 of the same UTC day
    expect(range.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-08-13T23:59:59.999Z");
    expect(range.to.getTime() - range.from.getTime()).toBe(13 * 86_400_000 - 1);
  });

  it("honours a full timestamp on the `to` bound exactly", () => {
    const range = resolveDateRange({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-13T18:30:00.000Z",
    });

    expect(range.to.toISOString()).toBe("2026-08-13T18:30:00.000Z");
  });

  it("rejects an invalid date string", () => {
    expect(() => resolveDateRange({ from: "not-a-date", to: "2026-08-13" })).toThrow(
      expect.objectContaining({ code: "INVALID_DATE_RANGE" })
    );
  });
});
