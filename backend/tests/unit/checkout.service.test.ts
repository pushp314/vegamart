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

jest.mock("../../src/repositories/cart.repository", () => ({
  getOrCreate: jest.fn(),
  clear: jest.fn(),
}));

jest.mock("../../src/repositories/coupon.repository", () => ({
  recordUsage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  findByProductId: jest.fn(),
  reserveQuantity: jest.fn(),
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

import { cartService } from "../../src/services/cart.service";
import { couponService } from "../../src/services/coupon.service";
import * as cartRepo from "../../src/repositories/cart.repository";
import * as couponRepo from "../../src/repositories/coupon.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import * as orderRepo from "../../src/repositories/order.repository";
import * as paymentRepo from "../../src/repositories/payment.repository";
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
          vendor_id: "v1",
          category_id: "c1",
          images: [],
        },
      },
    ],
  };
}

function makeVendor() {
  return {
    id: "v1",
    user_id: "u-vendor",
    business_name: "Sharma Store",
    min_order: dec(0),
    delivery_fee: dec(30),
  } as any;
}

describe("checkout service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    });

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
    invRepo.findByProductId.mockResolvedValue({ quantity: 10, reserved: 0 } as any);
    orderRepoMock.createOrder.mockResolvedValue({ id: "order-1", order_number: "GC-1", vendor_id: "v1" } as any);
    orderRepoMock.updateOrder.mockResolvedValue({ id: "order-1" } as any);
    orderRepoMock.updateOrderStatus.mockResolvedValue({ id: "order-1" } as any);
    orderRepoMock.findById.mockResolvedValue({ id: "order-1", items: [{ product_id: "p1", quantity: 2 }] } as any);
    paymentRepoMock.createForOrder.mockResolvedValue({ id: "pay-1" } as any);
    gatewayMock.createOrder.mockResolvedValue({ id: "rzp-1" } as any);
    couponRepoMock.recordUsage.mockResolvedValue(undefined);

    const result = await checkoutService.placeOrder("u1", { address_id: "addr-1", payment_method: "RAZORPAY" }, mockReq);

    expect(result.orders).toHaveLength(1);
    expect(gatewayMock.createOrder).toHaveBeenCalled();
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
    invRepo.findByProductId.mockResolvedValue({ quantity: 1, reserved: 0 } as any);

    await expect(checkoutService.placeOrder("u1", { address_id: "addr-1", payment_method: "RAZORPAY" }, mockReq)).rejects.toMatchObject({
      statusCode: 422,
      code: "INSUFFICIENT_STOCK",
    });
  });
});
