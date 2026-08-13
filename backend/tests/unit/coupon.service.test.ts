import { couponService } from "../../src/services/coupon.service";

jest.mock("../../src/repositories/coupon.repository", () => ({
  findByCode: jest.fn(),
  findById: jest.fn(),
  listCoupons: jest.fn(),
  listActiveBetween: jest.fn(),
  countUsages: jest.fn(),
  countUserUsages: jest.fn(),
  createCoupon: jest.fn(),
  updateCoupon: jest.fn(),
  softDelete: jest.fn(),
  recordUsage: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as couponRepo from "../../src/repositories/coupon.repository";
import type { CartRow } from "../../src/repositories/cart.repository";

const repo = couponRepo as jest.Mocked<typeof couponRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

function dec(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) } as any;
}

function makeCoupon(overrides: Partial<couponRepo.CouponRow> = {}): couponRepo.CouponRow {
  return {
    id: "coupon-1",
    code: "SAVE10",
    type: "PERCENTAGE",
    value: dec(10),
    max_discount: dec(100),
    min_order_value: dec(0),
    usage_limit: 0,
    per_user_limit: 1,
    used_count: 0,
    valid_from: new Date("2020-01-01"),
    valid_until: new Date("2030-01-01"),
    is_active: true,
    applies_to_vendor_ids: null,
    applies_to_product_ids: null,
    applies_to_category_ids: null,
    created_by_vendor_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCart(): CartRow {
  return {
    id: "cart-1",
    user_id: "u1",
    created_at: new Date(),
    updated_at: new Date(),
    items: [
      {
        id: "ci-1",
        product_id: "p1",
        quantity: 2,
        selected_unit: null,
        price_snapshot: dec(500),
        created_at: new Date(),
        updated_at: new Date(),
        product: {
          id: "p1",
          name: "Tomato",
          slug: "tomato",
          unit: "kg",
          price: dec(500),
          mrp: dec(600),
          is_active: true,
          is_available: true,
          stock: 10,
          vendor_id: "v1",
          category_id: "c1",
          images: [],
        },
      },
    ],
  };
}

function makeProduct(overrides: Partial<CartRow["items"][number]["product"]> = {}): CartRow["items"][number]["product"] {
  return {
    id: "p1",
    name: "Tomato",
    slug: "tomato",
    unit: "kg",
    price: dec(500),
    mrp: dec(600),
    is_active: true,
    is_available: true,
    stock: 10,
    vendor_id: "v1",
    category_id: "c1",
    images: [],
    ...overrides,
  };
}

function makeCartItem(product: CartRow["items"][number]["product"], quantity = 1): CartRow["items"][number] {
  return {
    id: `ci-${product.id}`,
    product_id: product.id,
    quantity,
    selected_unit: null,
    price_snapshot: product.price,
    created_at: new Date(),
    updated_at: new Date(),
    product,
  };
}

function makeMultiCart(...items: Array<CartRow["items"][number]>): CartRow {
  return { ...makeCart(), items };
}

describe("coupon service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("computes a percentage discount capped by max_discount", () => {
    const discount = couponService.computeDiscount(makeCoupon(), 5000);
    expect(discount).toBe(100);
  });

  it("computes a fixed discount", () => {
    const discount = couponService.computeDiscount(makeCoupon({ type: "FIXED", value: dec(50) }), 5000);
    expect(discount).toBe(50);
  });

  it("validates a valid coupon for the cart", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon());
    repo.countUserUsages.mockResolvedValue(0);
    const result = await couponService.validate("save10", makeCart(), "u1");
    expect(result.discount).toBe(100);
    expect(result.coupon.code).toBe("SAVE10");
  });

  it("rejects an expired coupon", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon({ valid_until: new Date("2020-01-01") }));
    await expect(couponService.validate("SAVE10", makeCart(), "u1")).rejects.toMatchObject({
      statusCode: 400,
      code: "COUPON_EXPIRED",
    });
  });

  it("rejects an exhausted coupon", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon({ usage_limit: 5, used_count: 5 }));
    await expect(couponService.validate("SAVE10", makeCart(), "u1")).rejects.toMatchObject({
      statusCode: 400,
      code: "COUPON_EXHAUSTED",
    });
  });

  it("rejects when the user exceeded per-user limit", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon({ per_user_limit: 1 }));
    repo.countUserUsages.mockResolvedValue(1);
    await expect(couponService.validate("SAVE10", makeCart(), "u1")).rejects.toMatchObject({
      statusCode: 400,
      code: "COUPON_PER_USER_LIMIT",
    });
  });

  it("rejects when the cart is below min order value", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon({ min_order_value: dec(5000) }));
    await expect(couponService.validate("SAVE10", makeCart(), "u1")).rejects.toMatchObject({
      statusCode: 400,
      code: "MIN_ORDER_VALUE",
    });
  });

  it("rejects when vendor restriction does not match cart", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon({ applies_to_vendor_ids: "v-other" }));
    await expect(couponService.validate("SAVE10", makeCart(), "u1")).rejects.toMatchObject({
      statusCode: 400,
      code: "COUPON_NOT_APPLICABLE",
    });
  });

  it("creates a coupon with uppercase code", async () => {
    repo.findByCode.mockResolvedValue(null);
    repo.createCoupon.mockResolvedValue(makeCoupon());
    await couponService.create({ code: "save10", type: "PERCENTAGE", value: 10, valid_from: new Date(), valid_until: new Date() } as any, mockReq);
    expect(repo.createCoupon).toHaveBeenCalledWith(expect.objectContaining({ code: "SAVE10" }));
  });

  it("throws 409 on duplicate coupon code", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon());
    await expect(couponService.create({ code: "SAVE10", type: "PERCENTAGE", value: 10 } as any, mockReq)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("soft-deletes a coupon", async () => {
    repo.findById.mockResolvedValue(makeCoupon());
    repo.softDelete.mockResolvedValue(undefined);
    await couponService.remove("coupon-1", mockReq);
    expect(repo.softDelete).toHaveBeenCalledWith("coupon-1");
  });

  it("throws 404 when deleting a missing coupon", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(couponService.remove("missing", mockReq)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("only discounts items that match a product restriction", async () => {
    const cart = makeMultiCart(makeCartItem(makeProduct(), 2), makeCartItem(makeProduct({ id: "p2", name: "Onion", category_id: "c2" }), 1));
    const coupon = makeCoupon({ applies_to_product_ids: "p1", type: "FIXED", value: dec(200), max_discount: null });
    repo.findByCode.mockResolvedValue(coupon);
    repo.countUserUsages.mockResolvedValue(0);

    const result = await couponService.validate("SAVE10", cart, "u1");

    // Eligible subtotal is only p1 (2 x 500 = 1000), never the restricted-out item.
    expect(result.eligible_subtotal).toBe(1000);
    expect(result.discount).toBe(200);
    expect(result.group_discounts).toEqual({ v1: 200 });
  });

  it("only discounts items that match a category restriction", async () => {
    const cart = makeMultiCart(makeCartItem(makeProduct()), makeCartItem(makeProduct({ id: "p2", name: "Onion", category_id: "c2" }), 1));
    const coupon = makeCoupon({ applies_to_category_ids: "c2", type: "FIXED", value: dec(200), max_discount: null });
    repo.findByCode.mockResolvedValue(coupon);
    repo.countUserUsages.mockResolvedValue(0);

    const result = await couponService.validate("SAVE10", cart, "u1");

    expect(result.eligible_subtotal).toBe(500);
    expect(result.discount).toBe(200);
    expect(result.group_discounts).toEqual({ v1: 200 });
  });

  it("rejects a coupon whose category restriction matches no item", async () => {
    repo.findByCode.mockResolvedValue(makeCoupon({ applies_to_category_ids: "c-missing" }));
    await expect(couponService.validate("SAVE10", makeCart(), "u1")).rejects.toMatchObject({
      statusCode: 400,
      code: "COUPON_NOT_APPLICABLE",
    });
  });

  it("allocates a discount across vendors proportionally to eligible subtotals", () => {
    const vendorSubtotals = new Map([
      ["v1", 3000],
      ["v2", 1000],
      ["v3", 0],
    ]);
    const shares = couponService.allocateDiscount(100, vendorSubtotals);
    expect(shares).toEqual({ v1: 75, v2: 25 });
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("allocates no discount when no items are eligible", () => {
    expect(couponService.allocateDiscount(100, new Map([["v1", 0]]))).toEqual({});
  });

  it("caps a fixed discount at the eligible subtotal", () => {
    const discount = couponService.computeDiscount(makeCoupon({ type: "FIXED", value: dec(9999), max_discount: null }), 120);
    expect(discount).toBe(120);
  });

  it("returns a per-vendor discount map for a vendor-restricted coupon", async () => {
    const coupon = makeCoupon({ applies_to_vendor_ids: "v1", type: "FIXED", value: dec(100), max_discount: null });
    repo.findByCode.mockResolvedValue(coupon);
    repo.countUserUsages.mockResolvedValue(0);

    const result = await couponService.validate("SAVE10", makeCart(), "u1");

    expect(result.discount).toBe(100);
    expect(result.group_discounts).toEqual({ v1: 100 });
  });
});
