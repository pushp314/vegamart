import { orderService } from "../../src/services/order.service";

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: {
    send: jest.fn(),
    orderStatus: jest.fn().mockResolvedValue(undefined),
    payment: jest.fn(),
    vendor: jest.fn(),
  },
}));

jest.mock("../../src/services/vendor.service", () => ({
  vendorService: { getMyVendor: jest.fn() },
}));

jest.mock("../../src/repositories/order.repository", () => ({
  listOrders: jest.fn(),
  findById: jest.fn(),
  updateOrderStatus: jest.fn(),
  updateOrder: jest.fn(),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  releaseQuantityForOrder: jest.fn(),
  consumeQuantityForOrder: jest.fn(),
}));

import * as orderRepo from "../../src/repositories/order.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import { vendorService } from "../../src/services/vendor.service";

const repo = orderRepo as jest.Mocked<typeof orderRepo>;
const invRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;
const vendorServiceMock = vendorService as jest.Mocked<typeof vendorService>;

const mockReq = { user: { id: "u1" } } as any;

function dec(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) } as any;
}

function makeOrder(overrides: Partial<orderRepo.OrderRow> = {}) {
  return {
    id: "order-1",
    order_number: "GC-1",
    user_id: "u1",
    vendor_id: "v1",
    delivery_partner_id: null,
    address_id: "addr-1",
    coupon_id: null,
    status: "PENDING",
    items_subtotal: dec(200),
    delivery_fee: dec(30),
    discount: dec(0),
    tax: dec(10),
    total: dec(240),
    payment_method: "RAZORPAY",
    payment_status: "PENDING",
    invoice_number: null,
    otp_code: null,
    delivery_note: null,
    delivered_at: null,
    cancelled_at: null,
    cancel_reason: null,
    refunded_at: null,
    refund_reason: null,
    accepted_at: null,
    prepared_at: null,
    packed_at: null,
    picked_up_at: null,
    started_at: null,
    eta_minutes: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as any;
}

describe("order service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists a customer's orders", async () => {
    repo.listOrders.mockResolvedValue({ rows: [makeOrder()], total: 1 });
    const result = await orderService.listMyOrders("u1", { page: 1, per_page: 20 });
    expect(result.rows).toHaveLength(1);
    expect(repo.listOrders).toHaveBeenCalledWith({ userId: "u1", status: undefined }, 0, 20);
  });

  it("lists a vendor's orders using the vendor profile", async () => {
    vendorServiceMock.getMyVendor.mockResolvedValue({ id: "v1" } as any);
    repo.listOrders.mockResolvedValue({ rows: [], total: 0 });
    await orderService.listVendorOrders("u-vendor", {});
    expect(repo.listOrders).toHaveBeenCalledWith({ vendorId: "v1", status: undefined }, 0, 20);
  });

  it("throws 404 for a missing order", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(orderService.getOrderForUser("u1", "missing")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 403 when the order belongs to another user", async () => {
    repo.findById.mockResolvedValue(makeOrder({ user_id: "other" }));
    await expect(orderService.getOrderForUser("u1", "order-1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("cancels an order in a cancelable status", async () => {
    repo.findById.mockResolvedValue(makeOrder());
    repo.updateOrderStatus.mockResolvedValue(makeOrder({ status: "CANCELLED", cancelled_at: new Date() }));

    const updated = await orderService.cancelOrder("u1", "order-1", { reason: "Changed mind" }, mockReq);
    expect(updated.status).toBe("CANCELLED");
    expect(repo.updateOrderStatus).toHaveBeenCalledWith("order-1", expect.objectContaining({ status: "CANCELLED" }));
  });

  it("rejects cancelling an order not in a cancelable status", async () => {
    repo.findById.mockResolvedValue(makeOrder({ status: "OUT_FOR_DELIVERY" }));
    await expect(orderService.cancelOrder("u1", "order-1", {}, mockReq)).rejects.toMatchObject({
      statusCode: 400,
      code: "NOT_CANCELLABLE",
    });
  });

  it("releases reserved inventory when cancelling a paid order", async () => {
    repo.findById.mockResolvedValue(makeOrder({ payment_status: "PAID" }));
    repo.updateOrderStatus.mockResolvedValue(makeOrder({ status: "CANCELLED" }));
    await orderService.cancelOrder("u1", "order-1", {}, mockReq);
    expect(invRepo.releaseQuantityForOrder).toHaveBeenCalledWith("order-1");
  });

  it("transitions status and consumes inventory on delivery", async () => {
    vendorServiceMock.getMyVendor.mockResolvedValue({ id: "v1" } as any);
    repo.findById.mockResolvedValue(makeOrder());
    repo.updateOrderStatus.mockResolvedValue(makeOrder({ status: "DELIVERED", delivered_at: new Date() }));

    const updated = await orderService.transitionStatus("u-vendor", "order-1", { status: "DELIVERED" }, mockReq);
    expect(updated.status).toBe("DELIVERED");
    expect(invRepo.consumeQuantityForOrder).toHaveBeenCalledWith("order-1");
  });

  it("throws 403 when a vendor transitions another vendor's order", async () => {
    vendorServiceMock.getMyVendor.mockResolvedValue({ id: "v-other" } as any);
    repo.findById.mockResolvedValue(makeOrder());
    await expect(orderService.transitionStatus("u-vendor", "order-1", { status: "CONFIRMED" }, mockReq)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
