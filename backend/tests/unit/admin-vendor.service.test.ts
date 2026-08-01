import { Prisma } from "@prisma/client";

import { adminVendorService } from "../../src/services/admin-vendor.service";

jest.mock("../../src/repositories/vendor.repository", () => ({
  findById: jest.fn(),
  listVendors: jest.fn(),
  updateVendor: jest.fn(),
  restore: jest.fn(),
  getVendorStats: jest.fn(),
  getVendorDetail: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as vendorRepo from "../../src/repositories/vendor.repository";

const repo = vendorRepo as jest.Mocked<typeof vendorRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

function makeVendor(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    user_id: "u1",
    business_name: "Sharma Store",
    slug: "sharma-store",
    status: "PENDING",
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("admin vendor service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("lists vendors including all statuses", async () => {
    repo.listVendors.mockResolvedValue({
      rows: [makeVendor({ status: "PENDING" }) as any],
      total: 1,
    });

    const result = await adminVendorService.list({ page: 1, per_page: 20 });

    expect(repo.listVendors).toHaveBeenCalledWith(
      expect.objectContaining({ includeAll: true, status: undefined }),
      expect.any(Number),
      expect.any(Number)
    );
    expect(result.total).toBe(1);
  });

  it("approves a vendor and audits the action", async () => {
    repo.findById.mockResolvedValue(makeVendor() as any);
    repo.updateVendor.mockResolvedValue(makeVendor({ status: "APPROVED", is_verified: true }) as any);

    const result = await adminVendorService.review("admin-1", "v1", "approve", null, mockReq);

    expect(repo.updateVendor).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ status: "APPROVED", is_verified: true, rejection_reason: null })
    );
    expect(result.status).toBe("APPROVED");
  });

  it("rejects a vendor with a reason", async () => {
    repo.findById.mockResolvedValue(makeVendor() as any);
    repo.updateVendor.mockResolvedValue(makeVendor({ status: "REJECTED" }) as any);

    await adminVendorService.review("admin-1", "v1", "reject", "Invalid docs", mockReq);

    expect(repo.updateVendor).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ status: "REJECTED", is_verified: false, rejection_reason: "Invalid docs" })
    );
  });

  it("restores a vendor to approved", async () => {
    repo.findById.mockResolvedValue(makeVendor({ status: "SUSPENDED" }) as any);
    repo.restore.mockResolvedValue(makeVendor({ status: "APPROVED" }) as any);

    const result = await adminVendorService.restore("admin-1", "v1", mockReq);

    expect(result.status).toBe("APPROVED");
  });

  it("returns vendor detail with stats", async () => {
    repo.getVendorDetail.mockResolvedValue(makeVendor() as any);
    repo.getVendorStats.mockResolvedValue({
      total_orders: 5,
      active_orders: 2,
      total_revenue: new Prisma.Decimal(1000),
      total_earnings: new Prisma.Decimal(50),
      pending_earnings: new Prisma.Decimal(20),
      product_count: 10,
      out_of_stock_count: 1,
    });

    const result = await adminVendorService.getById("v1");

    expect(result.stats.total_orders).toBe(5);
    expect(result.stats.total_revenue.toString()).toBe("1000");
  });

  it("throws NOT_FOUND for a missing vendor", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(adminVendorService.review("admin-1", "v1", "approve", null, mockReq)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
