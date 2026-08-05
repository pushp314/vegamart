jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

const mockQueryRaw = jest.requireMock("../../src/database/prisma").default.$queryRaw as jest.Mock;

import * as dashboardRepo from "../../src/repositories/dashboard.repository";
import * as analyticsRepo from "../../src/repositories/analytics.repository";
import * as reportsRepo from "../../src/repositories/reports.repository";

function sqlArg(call: unknown[]): string {
  const sql = call[0] as { strings?: string[]; values?: unknown[] };
  if (Array.isArray(sql.strings) && sql.strings.length > 0) {
    const parts: string[] = [];
    sql.strings.forEach((s, i) => {
      parts.push(s);
      if (i < (sql.values?.length ?? 0)) {
        parts.push(String(sql.values![i]));
      }
    });
    return parts.join("");
  }
  return String(call[0]);
}

describe("raw SQL order-status enum literals", () => {
  beforeEach(() => {
    mockQueryRaw.mockClear();
  });

  it("uses lowercase OrderStatus values in dashboard charts SQL", async () => {
    await dashboardRepo.getDashboardCharts(7);
    const sql = sqlArg(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain("NOT IN ('cancelled', 'failed')");
    expect(sql).not.toContain("CANCELLED");
    expect(sql).not.toContain("FAILED");
  });

  it("uses lowercase OrderStatus values in analytics top-products SQL", async () => {
    const range = { from: new Date("2026-01-01"), to: new Date("2026-02-01") };
    await analyticsRepo.topProducts(range, 5);
    const sql = sqlArg(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain("NOT IN ('cancelled', 'failed')");
    expect(sql).not.toContain("CANCELLED");
    expect(sql).not.toContain("FAILED");
  });

  it("uses lowercase OrderStatus values in reports revenue SQL", async () => {
    const range = { from: new Date("2026-01-01"), to: new Date("2026-02-01") };
    await reportsRepo.revenueReport(range, "daily");
    const sql = sqlArg(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain("NOT IN ('cancelled', 'failed')");
    expect(sql).not.toContain("CANCELLED");
    expect(sql).not.toContain("FAILED");
  });
});
