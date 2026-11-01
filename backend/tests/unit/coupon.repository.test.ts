import { Prisma } from "@prisma/client";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    coupon: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    couponUsage: { findUnique: jest.fn(), delete: jest.fn() },
  },
}));

import prisma from "../../src/database/prisma";
import { listAvailableForCustomer, releaseUsage, softDelete } from "../../src/repositories/coupon.repository";

const db = prisma as any;

const rawRow = {
  id: "c1",
  code: "SAVE10",
  type: "PERCENTAGE",
  value: new Prisma.Decimal("10"),
  max_discount: null,
  min_order_value: null,
  usage_limit: 20,
  per_user_limit: 1,
  used_count: 3,
  valid_from: new Date("2026-08-01T00:00:00Z"),
  valid_until: new Date("2026-08-31T00:00:00Z"),
  is_active: true,
  applies_to_vendor_ids: null,
  applies_to_product_ids: null,
  applies_to_category_ids: null,
  created_by_vendor_id: null,
  created_at: new Date("2026-08-01T00:00:00Z"),
  updated_at: new Date("2026-08-01T00:00:00Z"),
} as never;

describe("coupon repository — listAvailableForCustomer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters to active, in-window, non-exhausted coupons in SQL", async () => {
    db.$queryRaw.mockResolvedValue([]);

    const now = new Date("2026-08-13T10:00:00Z");
    await listAvailableForCustomer(now);

    const [strings, ...values] = db.$queryRaw.mock.calls[0];
    const sql = strings.join("?");
    expect(sql).toContain("is_active = true");
    expect(sql).toContain("valid_from <=");
    expect(sql).toContain("valid_until >=");
    expect(sql).toContain("(usage_limit = 0 OR used_count < usage_limit)");
    expect(values).toEqual([now, now]);
  });

  it("maps raw rows to CouponRow values", async () => {
    db.$queryRaw.mockResolvedValue([rawRow]);

    const rows = await listAvailableForCustomer(new Date());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "c1",
      code: "SAVE10",
      type: "PERCENTAGE",
      used_count: 3,
    });
  });
});

describe("coupon repository — softDelete", () => {
  it("renames code and sets deleted_at to allow reuse of the code", async () => {
    db.coupon.findUnique.mockResolvedValue({ code: "WELCOME10" });
    db.coupon.update.mockResolvedValue({});

    await softDelete("c1");

    expect(db.coupon.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({
        is_active: false,
        code: expect.stringContaining("WELCOME10_del_"),
      }),
    });
  });
});

describe("coupon repository — releaseUsage", () => {
  it("deletes CouponUsage and decrements used_count when usage exists", async () => {
    db.couponUsage.findUnique.mockResolvedValue({ id: "cu-1", coupon_id: "c1" });
    db.couponUsage.delete.mockResolvedValue({});
    db.coupon.update.mockResolvedValue({});

    const released = await releaseUsage("order-1");

    expect(released).toBe(true);
    expect(db.couponUsage.delete).toHaveBeenCalledWith({ where: { id: "cu-1" } });
    expect(db.coupon.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { used_count: { decrement: 1 } },
    });
  });

  it("returns false when no CouponUsage exists for the order", async () => {
    db.couponUsage.findUnique.mockResolvedValue(null);

    const released = await releaseUsage("order-99");

    expect(released).toBe(false);
    expect(db.couponUsage.delete).not.toHaveBeenCalled();
    expect(db.coupon.update).not.toHaveBeenCalled();
  });
});

