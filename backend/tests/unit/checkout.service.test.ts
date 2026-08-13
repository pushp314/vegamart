import { checkoutService } from "../../src/services/checkout.service";

jest.mock("../../src/services/cart.service", () => ({
  cartService: { getMyCart: jest.fn() },
}));

jest.mock("../../src/services/coupon.service", () => ({
  couponService: { validateForCart: jest.fn() },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: {
    send: jest.fn(),
    orderStatus: jest.fn().mockResolvedValue(undefined),
    payment: jest.fn().mockResolvedValue(undefined),
    vendor: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/analytics.service", () => ({
  analyticsService: {
    recordOrder: jest.fn().mockResolvedValue(undefined),
    recordCustomer: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../src/services/membership-plan.service", () => ({
  membershipPlanService: {
    getMyMembership: jest.fn().mockResolvedValue({
      tier: "basic",
      plan: { daily_order_limit: 5 },
      is_expired: false,
    }),
  },
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({})),
  },
}));

jest.mock("../../src/services/settings.service", () => ({
  settingsService: {
    getAllSettings: jest.fn().mockResolvedValue({
      "platform.delivery_fee": 30,
      "platform.free_delivery_threshold": 0,
      "platform.tax_rate_percent": 5,
      "platform.multi_store_checkout_enabled": true,
    }),
  },
}));

jest.mock("../../src/repositories/cart.repository", () => ({
  getOrCreate: jest.fn(),
  clear: jest.fn(),
}));

jest.mock("../../src/repositories/coupon.repository", () => ({
  claimUsage: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  reserveAvailable: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/repositories/order.repository", () => ({
  createOrder: jest.fn(),
  updateOrder: jest.fn(),
  updateOrderStatus: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../../src/repositories/payment.repository", () => ({
  createForOrder: jest.fn(),
}));

jest.mock("../../src/repositories/checkout-idempotency.repository", () => ({
  findByKey: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: "ci-1" }),
  setResponse: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/repositories/daily-order-counter.repository", () => ({
  incrementForVendor: jest.fn().mockResolvedValue(1),
}));

jest.mock("../../src/repositories/transaction.repository", () => ({
  create: jest.fn(),
}));

jest.mock("../../src/repositories/address.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/repositories/vendor.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/payments/razorpay.gateway", () => ({
  razorpayGateway: { createOrder: jest.fn() },
}));

jest.mock("../../src/utils/cart", () => ({
  cartFromItems: jest.fn(),
}));

import { cartService } from "../../src/services/cart.service";
import { couponService } from "../../src/services/coupon.service";
import { cartFromItems } from "../../src/utils/cart";
import * as cartRepo from "../../src/repositories/cart.repository";
import * as couponRepo from "../../src/repositories/coupon.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import * as orderRepo from "../../src/repositories/order.repository";
import * as paymentRepo from "../../src/repositories/payment.repository";
import * as checkoutIdempotencyRepo from "../../src/repositories/checkout-idempotency.repository";
import * as dailyOrderCounterRepo from "../../src/repositories/daily-order-counter.repository";
import * as addressRepo from "../../src/repositories/address.repository";
import * as vendorRepo from "../../src/repositories/vendor.repository";
import { razorpayGateway } from "../../src/payments/razorpay.gateway";

const mockedCartService = cartService as jest.Mocked<typeof cartService>;
const mockedCouponService = couponService as jest.Mocked<typeof couponService>;
const orderRepoMock = orderRepo as jest.Mocked<typeof orderRepo>;
const paymentRepoMock = paymentRepo as jest.Mocked<typeof paymentRepo>;
const invRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;
const couponRepoMock = couponRepo as jest.Mocked<typeof couponRepo>;
const addressRepoMock = addressRepo as jest.Mocked<typeof addressRepo>;
const vendorRepoMock = vendorRepo as jest.Mocked<typeof vendorRepo>;
const gatewayMock = razorpayGateway as jest.Mocked<typeof razorpayGateway>;
const idemRepoMock = checkoutIdempotencyRepo as jest.Mocked<typeof checkoutIdempotencyRepo>;
const dailyCounterRepoMock = dailyOrderCounterRepo as jest.Mocked<typeof dailyOrderCounterRepo>;

const mockReq = { user: { id: "u1" } } as any;

function dec(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) } as any;
}

function makeCart(): cartRepo.CartRow {
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
        price_snapshot: dec(100),
        created_at: new Date(),
        updated_at: new Date(),
        product: {
          id: "p1",
          name: "Tomato",
          slug: "tomato",
          unit: "kg",
          price: dec(100),
          mrp: dec(120),
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

function makeVendor(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    user_id: "u-vendor",
    business_name: "Sharma Store",
    min_order: dec(0),
    delivery_fee: dec(30),
    free_delivery_min_order: null,
    is_open: true,
    provides_delivery: false,
    ...overrides,
  } as any;
}

function makeItem(product: cartRepo.CartRow["items"][number]["product"], quantity = 1): cartRepo.CartRow["items"][number] {
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

function makeOrderRow(overrides: Record<string, unknown> = {}): any {
  return {
    id: "order-1",
    order_number: "GC-1",
    vendor_id: "v1",
    status: "PENDING",
    total: dec(240),
    delivery_fee: dec(30),
    payment_method: "RAZORPAY",
    eta_minutes: null,
    created_at: new Date(),
    ...overrides,
  };
}

function makePaymentRow(overrides: Record<string, unknown> = {}): any {
  return {
    id: "pay-1",
    method: "RAZORPAY",
    amount: dec(240),
    status: "PENDING",
    razorpay_order_id: "rzp-1",
    ...overrides,
  };
}

function extendCartWithSecondVendorItem(cart: cartRepo.CartRow): cartRepo.CartRow {
  const first = cart.items[0] as cartRepo.CartRow["items"][number];
  const second = makeItem(
    { ...first.product, id: "p2", name: "Onion", vendor_id: "v2", category_id: "c2" },
    1
  );
  return { ...cart, items: [...cart.items, second] };
}

describe("checkout service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invRepo.reserveAvailable.mockResolvedValue(undefined);
    dailyCounterRepoMock.incrementForVendor.mockResolvedValue(1);
    idemRepoMock.findByKey.mockResolvedValue(null);
    idemRepoMock.create.mockResolvedValue({ id: "ci-1" } as any);
    idemRepoMock.setResponse.mockResolvedValue(undefined);
  });

  it("builds a summary with delivery fee and tax", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());

    const summary = await checkoutService.preview("u1", {}, mockReq);

    expect(summary.items_subtotal).toBe(200);
    expect(summary.delivery_fee).toBe(30);
    expect(summary.tax).toBe(10);
    expect(summary.total).toBe(240);
    expect(summary.groups).toHaveLength(1);
  });

  it("applies a coupon discount", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    mockedCouponService.validateForCart.mockResolvedValue({
      coupon: { id: "c1", code: "SAVE10", type: "PERCENTAGE" } as any,
      discount: 20,
    } as any);

    const summary = await checkoutService.preview("u1", { coupon_code: "SAVE10" }, mockReq);

    expect(summary.discount).toBe(20);
    expect(summary.coupon?.code).toBe("SAVE10");
  });

  it("throws on an empty cart", async () => {
    mockedCartService.getMyCart.mockResolvedValue({ ...makeCart(), items: [] });
    await expect(checkoutService.preview("u1", {}, mockReq)).rejects.toMatchObject({
      statusCode: 400,
      code: "EMPTY_CART",
    });
  });

  it("places an order and creates a razorpay order", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    orderRepoMock.createOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrderStatus.mockResolvedValue(makeOrderRow());
    orderRepoMock.findById.mockResolvedValue({ id: "order-1", items: [{ product_id: "p1", quantity: 2 }] } as any);
    paymentRepoMock.createForOrder.mockResolvedValue(makePaymentRow());
    gatewayMock.createOrder.mockResolvedValue({ id: "rzp-1" } as any);
    couponRepoMock.claimUsage.mockResolvedValue(true);

    const result = await checkoutService.placeOrder("u1", { address_id: "addr-1", payment_method: "RAZORPAY" }, mockReq);

    expect(result.orders).toHaveLength(1);
    expect(gatewayMock.createOrder).toHaveBeenCalled();
    expect(invRepo.reserveAvailable).toHaveBeenCalled();
    expect(dailyCounterRepoMock.incrementForVendor).toHaveBeenCalled();
    expect(cartRepo.clear).toHaveBeenCalled();
  });

  it("throws 404 when the address does not belong to the user", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "other", deleted_at: null } as any);

    await expect(checkoutService.placeOrder("u1", { address_id: "addr-1", payment_method: "RAZORPAY" }, mockReq)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 422 when stock is insufficient", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    invRepo.reserveAvailable.mockRejectedValue({ statusCode: 422, code: "INSUFFICIENT_STOCK" });

    await expect(checkoutService.placeOrder("u1", { address_id: "addr-1", payment_method: "RAZORPAY" }, mockReq)).rejects.toMatchObject({
      statusCode: 422,
      code: "INSUFFICIENT_STOCK",
    });
    expect(cartRepo.clear).not.toHaveBeenCalled();
  });

  it("previews totals from the items provided instead of the saved cart", async () => {
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    (cartFromItems as jest.Mock).mockResolvedValue(makeCart());

    const summary = await checkoutService.preview(
      "u1",
      { items: [{ product_id: "p1", quantity: 2 }] },
      mockReq
    );

    expect(mockedCartService.getMyCart).not.toHaveBeenCalled();
    expect(cartFromItems).toHaveBeenCalledWith("u1", [{ product_id: "p1", quantity: 2 }]);
    expect(summary.items_subtotal).toBe(200);
    expect(summary.groups[0]?.vendor_id).toBe("v1");
  });

  it("keeps per-vendor delivery fees on a multi-vendor preview", async () => {
    const cart = extendCartWithSecondVendorItem(makeCart());
    mockedCartService.getMyCart.mockResolvedValue(cart);
    vendorRepoMock.findById
      .mockResolvedValueOnce(makeVendor())
      .mockResolvedValueOnce(makeVendor({ id: "v2", business_name: "Second Store", delivery_fee: dec(20) }));

    const summary = await checkoutService.preview("u1", {}, mockReq);

    expect(summary.groups).toHaveLength(2);
    expect(summary.groups[0]?.delivery_fee).toBe(30);
    expect(summary.groups[1]?.delivery_fee).toBe(20);
    expect(summary.delivery_fee).toBe(50);
  });

  it("applies per-vendor coupon discounts to a multi-vendor cart", async () => {
    const cart = extendCartWithSecondVendorItem(makeCart());
    mockedCartService.getMyCart.mockResolvedValue(cart);
    vendorRepoMock.findById
      .mockResolvedValueOnce(makeVendor())
      .mockResolvedValueOnce(makeVendor({ id: "v2", business_name: "Second Store" }));
    mockedCouponService.validateForCart.mockResolvedValue({
      coupon: { id: "c1", code: "SAVE10", type: "FIXED" } as any,
      discount: 50,
      eligible_subtotal: 300,
      group_discounts: { v1: 20, v2: 30 },
    } as any);

    const summary = await checkoutService.preview("u1", { coupon_code: "SAVE10" }, mockReq);

    expect(summary.discount).toBe(50);
    expect(summary.group_discounts).toEqual({ v1: 20, v2: 30 });
    expect(summary.coupon).toMatchObject({ id: "c1", code: "SAVE10", type: "FIXED", discount: 50 });
  });

  it("zeroes the delivery fee for a FREE_DELIVERY coupon", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    mockedCouponService.validateForCart.mockResolvedValue({
      coupon: { id: "c1", code: "FREEDEL", type: "FREE_DELIVERY" } as any,
      discount: 0,
      eligible_subtotal: 200,
      group_discounts: {},
    } as any);

    const summary = await checkoutService.preview("u1", { coupon_code: "FREEDEL" }, mockReq);

    expect(summary.delivery_fee).toBe(0);
    expect(summary.coupon?.type).toBe("FREE_DELIVERY");
  });

  it("uses per-vendor discount and tax rate when placing a multi-vendor order", async () => {
    const cart = extendCartWithSecondVendorItem(makeCart());
    mockedCartService.getMyCart.mockResolvedValue(cart);
    vendorRepoMock.findById
      .mockResolvedValueOnce(makeVendor())
      .mockResolvedValueOnce(makeVendor({ id: "v2", business_name: "Second Store", delivery_fee: dec(20) }));
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    orderRepoMock.createOrder
      .mockResolvedValueOnce(makeOrderRow())
      .mockResolvedValueOnce(makeOrderRow({ id: "order-2", order_number: "GC-2", vendor_id: "v2" }));
    orderRepoMock.updateOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrderStatus.mockResolvedValue(makeOrderRow());
    orderRepoMock.findById.mockResolvedValue({ id: "order-1", items: [{ product_id: "p1", quantity: 2 }] } as any);
    paymentRepoMock.createForOrder.mockResolvedValue(makePaymentRow());
    gatewayMock.createOrder.mockResolvedValue({ id: "rzp-1" } as any);
    mockedCouponService.validateForCart.mockResolvedValue({
      coupon: { id: "c1", code: "SAVE10", type: "FIXED" } as any,
      discount: 40,
      eligible_subtotal: 300,
      group_discounts: { v1: 30, v2: 10 },
    } as any);

    const result = await checkoutService.placeOrder(
      "u1",
      { address_id: "addr-1", payment_method: "RAZORPAY", coupon_code: "SAVE10" },
      mockReq
    );

    expect(result.orders).toHaveLength(2);
    expect(couponRepoMock.claimUsage).toHaveBeenCalledWith("c1", "order-1", "u1", 40, expect.anything());
    expect(orderRepoMock.createOrder).toHaveBeenCalledTimes(2);
  });

  it("rolls back the transaction and throws when the coupon claim is rejected", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    orderRepoMock.createOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrderStatus.mockResolvedValue(makeOrderRow());
    orderRepoMock.findById.mockResolvedValue({ id: "order-1", items: [{ product_id: "p1", quantity: 2 }] } as any);
    paymentRepoMock.createForOrder.mockResolvedValue(makePaymentRow());
    gatewayMock.createOrder.mockResolvedValue({ id: "rzp-1" } as any);
    mockedCouponService.validateForCart.mockResolvedValue({
      coupon: { id: "c1", code: "SAVE10", type: "FIXED" } as any,
      discount: 40,
      eligible_subtotal: 200,
      group_discounts: { v1: 40 },
    } as any);
    couponRepoMock.claimUsage.mockResolvedValue(false);

    await expect(
      checkoutService.placeOrder(
        "u1",
        { address_id: "addr-1", payment_method: "RAZORPAY", coupon_code: "SAVE10" },
        mockReq
      )
    ).rejects.toMatchObject({ statusCode: 400, code: "COUPON_EXHAUSTED" });

    expect(couponRepoMock.claimUsage).toHaveBeenCalledTimes(1);
    // No manual CANCELLED rollback is performed: the transaction itself rolls
    // back the created order atomically.
    expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ status: "CANCELLED" })
    );
  });

  it("does not claim coupon usage when no coupon is applied", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    orderRepoMock.createOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrderStatus.mockResolvedValue(makeOrderRow());
    orderRepoMock.findById.mockResolvedValue({ id: "order-1", items: [{ product_id: "p1", quantity: 2 }] } as any);
    paymentRepoMock.createForOrder.mockResolvedValue(makePaymentRow());
    gatewayMock.createOrder.mockResolvedValue({ id: "rzp-1" } as any);

    const result = await checkoutService.placeOrder(
      "u1",
      { address_id: "addr-1", payment_method: "RAZORPAY" },
      mockReq
    );

    expect(couponRepoMock.claimUsage).not.toHaveBeenCalled();
    expect(result.orders).toHaveLength(1);
  });

  it("throws DAILY_ORDER_LIMIT_REACHED when a vendor has exhausted their daily limit", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    dailyCounterRepoMock.incrementForVendor.mockResolvedValue(null);

    await expect(
      checkoutService.placeOrder("u1", { address_id: "addr-1", payment_method: "RAZORPAY" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 403, code: "DAILY_ORDER_LIMIT_REACHED" });
    expect(cartRepo.clear).not.toHaveBeenCalled();
  });

  it("replays the stored result when the same idempotency key is reused", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    const storedResponse = {
      summary: { total: 240 },
      orders: [{ order: { id: "order-1", order_number: "GC-1", total: 240 }, payment: { id: "pay-1", razorpay_order_id: "rzp-1" } }],
    };
    idemRepoMock.findByKey.mockResolvedValue({
      idempotency_key: "key-checkout-1",
      user_id: "u1",
      request_hash: "u1|addr-1|RAZORPAY||p1:2",
      response: storedResponse,
    } as any);

    const result = await checkoutService.placeOrder(
      "u1",
      { address_id: "addr-1", payment_method: "RAZORPAY", idempotency_key: "key-checkout-1" },
      mockReq
    );

    expect(result).toEqual(storedResponse);
    expect(orderRepoMock.createOrder).not.toHaveBeenCalled();
    expect(gatewayMock.createOrder).not.toHaveBeenCalled();
    expect(cartRepo.clear).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with a different request", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    idemRepoMock.findByKey.mockResolvedValue({
      idempotency_key: "key-checkout-1",
      user_id: "u1",
      request_hash: "u1|addr-1|RAZORPAY||p1:1",
      response: { summary: { total: 120 }, orders: [] },
    } as any);

    await expect(
      checkoutService.placeOrder(
        "u1",
        { address_id: "addr-1", payment_method: "RAZORPAY", idempotency_key: "key-checkout-1" },
        mockReq
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_REUSE_CONFLICT" });
    expect(orderRepoMock.createOrder).not.toHaveBeenCalled();
    expect(gatewayMock.createOrder).not.toHaveBeenCalled();
  });

  it("replays the winner's response when a concurrent duplicate hits a unique-violation (P2002)", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    idemRepoMock.create.mockRejectedValue({ code: "P2002", message: "duplicate key" });
    const winner = {
      idempotency_key: "key-checkout-1",
      user_id: "u1",
      request_hash: "u1|addr-1|RAZORPAY||p1:2",
      response: {
        summary: { total: 240 },
        orders: [{ order: { id: "order-1", order_number: "GC-1", total: 240 }, payment: { id: "pay-1", razorpay_order_id: "rzp-1" } }],
      },
    };
    idemRepoMock.findByKey.mockResolvedValueOnce(null).mockResolvedValue(winner as any);

    const result = await checkoutService.placeOrder(
      "u1",
      { address_id: "addr-1", payment_method: "RAZORPAY", idempotency_key: "key-checkout-1" },
      mockReq
    );

    expect(orderRepoMock.createOrder).not.toHaveBeenCalled();
    expect(result).toEqual(winner.response);
  });

  it("persists the idempotent response when an idempotency key is supplied", async () => {
    mockedCartService.getMyCart.mockResolvedValue(makeCart());
    vendorRepoMock.findById.mockResolvedValue(makeVendor());
    addressRepoMock.findById.mockResolvedValue({ id: "addr-1", user_id: "u1", deleted_at: null } as any);
    orderRepoMock.createOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrder.mockResolvedValue(makeOrderRow());
    orderRepoMock.updateOrderStatus.mockResolvedValue(makeOrderRow());
    orderRepoMock.findById.mockResolvedValue({ id: "order-1", items: [{ product_id: "p1", quantity: 2 }] } as any);
    paymentRepoMock.createForOrder.mockResolvedValue(makePaymentRow());
    gatewayMock.createOrder.mockResolvedValue({ id: "rzp-1" } as any);

    const result = await checkoutService.placeOrder(
      "u1",
      { address_id: "addr-1", payment_method: "RAZORPAY", idempotency_key: "key-checkout-1" },
      mockReq
    );

    expect(idemRepoMock.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idempotency_key: "key-checkout-1", user_id: "u1" }));
    expect(idemRepoMock.setResponse).toHaveBeenCalledWith(
      expect.anything(),
      "key-checkout-1",
      "u1",
      expect.objectContaining({ orders: result.orders })
    );
  });
});
