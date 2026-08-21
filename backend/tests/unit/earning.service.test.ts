/// <reference types="jest" />

import {
  computeVendorEarning,
  createOrderEarnings,
  reverseOrderEarnings,
  listVendorEarningsRecent,
  releaseEscrowEarnings,
  type OrderEarningInput,
} from "../../src/services/earning.service";

function dec(value: number) {
  return { toNumber: () => value } as any;
}

function makeDb() {
  return {
    vendorEarning: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "ve-1" }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn(),
    },
    deliveryEarning: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "de-1" }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn(),
    },
  } as any;
}

function makeOrder(overrides: Partial<OrderEarningInput> = {}): OrderEarningInput {
  return {
    id: "order-1",
    vendor_id: "v1",
    delivery_partner_id: null,
    items_subtotal: 1000,
    delivery_fee: 30,
    discount: 0,
    commission_rate: 5,
    items: [{ total_price: 1000, status: "active" }],
    ...overrides,
  };
}

describe("computeVendorEarning", () => {
  it("computes net = itemRevenue - commission at the vendor's rate", () => {
    const result = computeVendorEarning(makeOrder());
    expect(result.item_revenue).toBe(1000);
    expect(result.commission).toBe(50);
    expect(result.net).toBe(950);
  });

  it("subtracts the discount share from item revenue before commission", () => {
    const result = computeVendorEarning(makeOrder({ discount: 100 }));
    expect(result.item_revenue).toBe(900);
    expect(result.commission).toBe(45);
    expect(result.net).toBe(855);
  });

  it("excludes rejected items and scales the discount to the accepted share", () => {
    const result = computeVendorEarning(
      makeOrder({
        items_subtotal: 800,
        discount: 80,
        items: [
          { total_price: 600, status: "active" },
          { total_price: 200, status: "rejected" },
        ],
      })
    );
    expect(result.item_revenue).toBe(540);
    expect(result.commission).toBe(27);
    expect(result.net).toBe(513);
  });

  it("is safe with an empty/zero order", () => {
    const result = computeVendorEarning(makeOrder({ items_subtotal: 0, items: [] }));
    expect(result).toEqual({ item_revenue: 0, commission: 0, net: 0 });
  });
});

describe("createOrderEarnings", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
  });

  it("creates exactly one vendor ORDER_COMMISSION earning for a delivered order", async () => {
    await createOrderEarnings(makeOrder({ delivery_fee: 0 }), db);

    expect(db.vendorEarning.createMany).toHaveBeenCalledTimes(1);
    expect(db.vendorEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            vendor_id: "v1",
            order_id: "order-1",
            type: "ORDER_COMMISSION",
            amount: 950,
            reference_id: "earning-ORDER_COMMISSION",
          }),
        ],
        skipDuplicates: true,
      })
    );
    expect(db.deliveryEarning.createMany).not.toHaveBeenCalled();
  });

  it("marks self-delivery delivery fee as a vendor DELIVERY_FEE earning", async () => {
    await createOrderEarnings(makeOrder(), db);
    // One createMany for ORDER_COMMISSION + one for DELIVERY_FEE
    expect(db.vendorEarning.createMany).toHaveBeenCalledTimes(2);
    expect(db.vendorEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ type: "DELIVERY_FEE", amount: 30, reference_id: "earning-DELIVERY_FEE" }),
        ],
        skipDuplicates: true,
      })
    );
  });

  it("credits the delivery fee to the assigned delivery partner, not the vendor", async () => {
    await createOrderEarnings(makeOrder({ delivery_partner_id: "p1" }), db);

    // Vendor should only get ORDER_COMMISSION
    expect(db.vendorEarning.createMany).toHaveBeenCalledTimes(1);
    expect(db.vendorEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ type: "ORDER_COMMISSION" }),
        ],
      })
    );
    // Delivery partner gets DELIVERY_FEE
    expect(db.deliveryEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ delivery_partner_id: "p1", type: "DELIVERY_FEE", amount: 30, reference_id: "earning-DELIVERY_FEE" }),
        ],
        skipDuplicates: true,
      })
    );
  });

  it("relies on skipDuplicates for idempotency (unique constraint on order_id + reference_id)", async () => {
    // createMany with skipDuplicates handles dedup atomically via the DB unique constraint,
    // so even when called twice, no duplicate rows are created.
    await createOrderEarnings(makeOrder(), db);
    expect(db.vendorEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });
});

describe("reverseOrderEarnings", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    db.vendorEarning.aggregate
      .mockResolvedValueOnce({ _sum: { amount: dec(950) } }) // active (non-REFUND) vendor
      .mockResolvedValueOnce({ _sum: { amount: dec(0) } }); // existing REFUND vendor
  });

  it("reverses the full vendor earning with a negative REFUND row on a full refund", async () => {
    await reverseOrderEarnings(
      { id: "order-1", vendor_id: "v1", delivery_partner_id: null, total: 1080 },
      1,
      "ref-1",
      db
    );

    expect(db.vendorEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            vendor_id: "v1",
            order_id: "order-1",
            type: "REFUND",
            amount: -950,
            reference_id: "ref-1",
          }),
        ],
        skipDuplicates: true,
      })
    );
    expect(db.deliveryEarning.createMany).not.toHaveBeenCalled();
  });

  it("reverses proportionally to the refunded fraction", async () => {
    db.vendorEarning.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amount: dec(950) } })
      .mockResolvedValueOnce({ _sum: { amount: dec(0) } });

    await reverseOrderEarnings(
      { id: "order-1", vendor_id: "v1", delivery_partner_id: null, total: 1000 },
      0.25,
      "ref-1",
      db
    );

    const data = db.vendorEarning.createMany.mock.calls[0][0].data as Array<{ amount: number }>;
    expect(data[0]!.amount).toBeCloseTo(-237.5, 1);
  });

  it("is incremental: two partial refunds converge to the cumulative target", async () => {
    db.vendorEarning.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amount: dec(950) } })
      .mockResolvedValueOnce({ _sum: { amount: dec(0) } });

    await reverseOrderEarnings({ id: "order-1", vendor_id: "v1", delivery_partner_id: null, total: 1000 }, 0.25, "ref-1", db);
    expect(db.vendorEarning.createMany).toHaveBeenCalledTimes(1);

    // Second partial refund: already reversed 237.5, target still 237.5 → no delta.
    db.vendorEarning.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amount: dec(950) } })
      .mockResolvedValueOnce({ _sum: { amount: dec(-237.5) } });
    await reverseOrderEarnings({ id: "order-1", vendor_id: "v1", delivery_partner_id: null, total: 1000 }, 0.25, "ref-2", db);
    expect(db.vendorEarning.createMany).toHaveBeenCalledTimes(1);
  });

  it("also reverses the delivery fee earning when a partner was assigned", async () => {
    db.deliveryEarning.aggregate
      .mockResolvedValueOnce({ _sum: { amount: dec(30) } })
      .mockResolvedValueOnce({ _sum: { amount: dec(0) } });

    await reverseOrderEarnings(
      { id: "order-1", vendor_id: "v1", delivery_partner_id: "p1", total: 1080 },
      1,
      "ref-1",
      db
    );

    expect(db.deliveryEarning.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            delivery_partner_id: "p1",
            type: "REFUND",
            amount: -30,
            reference_id: "ref-1",
          }),
        ],
      })
    );
  });

  it("is a no-op when the order never earned anything (cancelled before delivery)", async () => {
    db.vendorEarning.aggregate.mockReset().mockResolvedValueOnce({ _sum: { amount: null } });
    await reverseOrderEarnings({ id: "order-1", vendor_id: "v1", delivery_partner_id: null, total: 1000 }, 1, "ref-1", db);
    expect(db.vendorEarning.createMany).not.toHaveBeenCalled();
  });
});

describe("listVendorEarningsRecent", () => {
  it("serializes ledger rows with order context for the dashboard", async () => {
    const db = makeDb();
    db.vendorEarning.findMany = jest.fn().mockResolvedValue([
      {
        id: "ve-1",
        created_at: new Date("2026-08-01"),
        type: "ORDER_COMMISSION",
        amount: dec(950),
        status: "PENDING",
        order: { order_number: "GC-1", items_subtotal: dec(1000), discount: dec(0), delivery_fee: dec(30), tax: dec(50) },
      },
    ]);

    const rows = await listVendorEarningsRecent("v1", 12, db);
    expect(rows[0]).toEqual({
      id: "ve-1",
      created_at: expect.any(Date),
      type: "ORDER_COMMISSION",
      amount: 950,
      status: "PENDING",
      order_number: "GC-1",
      order_revenue: 1000,
      total_amount: 1080,
      commission_amount: 50,
      commission_rate: 5,
      vendor_earning: 950,
    });
  });
});

describe("releaseEscrowEarnings", () => {
  it("transitions pending vendor and delivery earnings past the hold cutoff to SETTLED", async () => {
    const db = {
      vendorEarning: {
        updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
      deliveryEarning: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    } as any;

    const result = await releaseEscrowEarnings(24, db);

    expect(db.vendorEarning.updateMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        type: { not: "REFUND" },
        created_at: { lte: expect.any(Date) },
      },
      data: {
        status: "SETTLED",
        settled_at: expect.any(Date),
      },
    });
    expect(db.deliveryEarning.updateMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        type: { not: "REFUND" },
        created_at: { lte: expect.any(Date) },
      },
      data: {
        status: "SETTLED",
        settled_at: expect.any(Date),
      },
    });
    expect(result).toEqual({
      releasedVendorEarnings: 5,
      releasedDeliveryEarnings: 3,
    });
  });
});