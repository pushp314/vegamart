import {
  ALLOWED_ORDER_TRANSITIONS,
  CANCELLABLE_ORDER_STATUSES,
  assertOrderTransition,
  cancelOrderLifecycle,
  refundOrderLifecycle,
} from "../../src/services/order-lifecycle.service";

jest.mock("../../src/services/payment.service", () => ({
  paymentService: { refund: jest.fn() },
}));

jest.mock("../../src/repositories/order.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  releaseQuantityForOrder: jest.fn(),
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: { $transaction: jest.fn() },
}));

import * as orderRepo from "../../src/repositories/order.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import defaultPrisma from "../../src/database/prisma";
import { paymentService } from "../../src/services/payment.service";

const repo = orderRepo as jest.Mocked<typeof orderRepo>;
const invRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;
const paymentServiceMock = paymentService as jest.Mocked<typeof paymentService>;

const mockReq = { user: { id: "u1" } } as any;

const mockTx = {
  order: { updateMany: jest.fn() },
  orderEvent: { create: jest.fn() },
};
const prismaMock = defaultPrisma as any;

function dec(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) } as any;
}

function makeOrder(overrides: Record<string, unknown> = {}) {
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
    items: [],
    events: [],
    payment: null,
    coupon: null,
    vendor: null,
    address: null,
    ...overrides,
  } as any;
}

describe("order lifecycle - state machine", () => {
  it("rejects a transition that is not in the machine", () => {
    expect(() => assertOrderTransition("PENDING", "DELIVERED")).toThrow();
  });

  it("rejects a backwards transition", () => {
    expect(() => assertOrderTransition("PACKED", "CONFIRMED")).toThrow();
  });

  it("allows every forward transition defined in the machine", () => {
    const orderStatuses = [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "PACKED",
      "READY_FOR_PICKUP",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
      "RETURNED",
      "FAILED",
    ];
    for (const source of orderStatuses) {
      const targets = ALLOWED_ORDER_TRANSITIONS[source]!;
      for (const next of orderStatuses) {
        const allowed = targets.has(next);
        if (allowed) {
          expect(() => assertOrderTransition(source, next)).not.toThrow();
        } else {
          expect(() => assertOrderTransition(source, next)).toThrow();
        }
      }
    }
  });

  it("allows an idempotent self-transition", () => {
    expect(() => assertOrderTransition("DELIVERED", "DELIVERED")).not.toThrow();
  });

  it("derives the cancelable source statuses", () => {
    expect(CANCELLABLE_ORDER_STATUSES).toEqual(
      expect.arrayContaining(["PENDING", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP"])
    );
    expect(CANCELLABLE_ORDER_STATUSES).not.toContain("DELIVERED");
  });
});

describe("order lifecycle - cancelOrderLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx));
    mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockTx.orderEvent.create.mockResolvedValue({ id: "ev1" });
    invRepo.releaseQuantityForOrder.mockResolvedValue(undefined);
  });

  it("refunds a paid order before claiming CANCELLED and releases inventory in the same transaction", async () => {
    const order = makeOrder({ payment_status: "PAID" });
    paymentServiceMock.refund.mockResolvedValue({ status: "processed", payment: { status: "REFUNDED" } });
    repo.findById.mockResolvedValue(makeOrder({ status: "CANCELLED", payment_status: "REFUNDED" }));

    await cancelOrderLifecycle({ order, reason: "Changed mind", actorType: "customer", actorId: "u1", req: mockReq });

    expect(paymentServiceMock.refund).toHaveBeenCalledWith("u1", "order-1", expect.objectContaining({ reason: "Changed mind" }), mockReq);
    expect(mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "order-1", status: { in: expect.any(Array) } }),
        data: expect.objectContaining({ status: "CANCELLED", cancel_reason: "Changed mind", payment_status: "REFUNDED" }),
      })
    );
    expect(mockTx.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED", actor_type: "customer" }) })
    );
    expect(invRepo.releaseQuantityForOrder).toHaveBeenCalledWith("order-1", mockTx);
  });

  it("does not claim CANCELLED or release inventory when the refund fails", async () => {
    const order = makeOrder({ payment_status: "PAID" });
    paymentServiceMock.refund.mockRejectedValue(new Error("refund gateway timeout"));

    await expect(
      cancelOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq })
    ).rejects.toThrow("refund gateway timeout");
    expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    expect(invRepo.releaseQuantityForOrder).not.toHaveBeenCalled();
  });
  it("cancels a COD order without a gateway refund and still releases inventory", async () => {
    const order = makeOrder({ payment_method: "COD", payment_status: "PENDING" });
    repo.findById.mockResolvedValue(makeOrder({ status: "CANCELLED", payment_method: "COD" }));

    await cancelOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq });

    expect(paymentServiceMock.refund).not.toHaveBeenCalled();
    expect(mockTx.order.updateMany).toHaveBeenCalled();
    expect(invRepo.releaseQuantityForOrder).toHaveBeenCalledWith("order-1", mockTx);
  });

  it("completes cancellation when the refund already succeeded on a previous attempt", async () => {
    const order = makeOrder({ payment_status: "PAID" });
    paymentServiceMock.refund.mockRejectedValue(
      Object.assign(new Error("Payment has already been refunded."), { statusCode: 400, code: "ALREADY_REFUNDED" })
    );
    repo.findById.mockResolvedValue(makeOrder({ status: "CANCELLED", payment_status: "REFUNDED" }));

    await cancelOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq });

    expect(paymentServiceMock.refund).toHaveBeenCalledTimes(1);
    expect(mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED", payment_status: "REFUNDED" }) })
    );
    expect(invRepo.releaseQuantityForOrder).toHaveBeenCalledWith("order-1", mockTx);
  });

  it("is idempotent for an already-cancelled order", async () => {
    const order = makeOrder({ status: "CANCELLED", cancelled_at: new Date() });

    const result = await cancelOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq });

    expect(result.status).toBe("CANCELLED");
    expect(paymentServiceMock.refund).not.toHaveBeenCalled();
    expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    expect(invRepo.releaseQuantityForOrder).not.toHaveBeenCalled();
  });

  it("rejects cancellation from a non-cancelable status before any side effect", async () => {
    const order = makeOrder({ status: "DELIVERED" });

    await expect(
      cancelOrderLifecycle({ order, reason: null, actorType: "admin", actorId: "a1", req: mockReq })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS" });
    expect(paymentServiceMock.refund).not.toHaveBeenCalled();
    expect(mockTx.order.updateMany).not.toHaveBeenCalled();
  });

  it("releases inventory exactly once: a lost claim short-circuits idempotently", async () => {
    const order = makeOrder({ payment_status: "PENDING" });
    mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    repo.findById.mockResolvedValue(makeOrder({ status: "CANCELLED", cancelled_at: new Date() }));

    const result = await cancelOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq });

    expect(result.status).toBe("CANCELLED");
    expect(invRepo.releaseQuantityForOrder).not.toHaveBeenCalled();
    expect(invRepo.releaseQuantityForOrder).toHaveBeenCalledTimes(0);
  });

  it("throws NOT_CANCELLABLE when the claim is lost and the order moved on", async () => {
    const order = makeOrder({ payment_status: "PENDING" });
    mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    repo.findById.mockResolvedValue(makeOrder({ status: "PICKED_UP" }));

    await expect(
      cancelOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq })
    ).rejects.toMatchObject({ statusCode: 409, code: "NOT_CANCELLABLE" });
    expect(invRepo.releaseQuantityForOrder).not.toHaveBeenCalled();
  });
});

describe("order lifecycle - refundOrderLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx));
    mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockTx.orderEvent.create.mockResolvedValue({ id: "ev1" });
    invRepo.releaseQuantityForOrder.mockResolvedValue(undefined);
  });

  it("refunds a paid delivered order before claiming REFUNDED", async () => {
    const order = makeOrder({ status: "DELIVERED", payment_status: "PAID" });
    paymentServiceMock.refund.mockResolvedValue({ status: "processed", payment: { status: "REFUNDED" } });
    repo.findById.mockResolvedValue(makeOrder({ status: "REFUNDED", payment_status: "REFUNDED" }));

    await refundOrderLifecycle({ order, reason: "Not satisfied", actorType: "customer", actorId: "u1", req: mockReq });

    expect(paymentServiceMock.refund).toHaveBeenCalledWith("u1", "order-1", expect.objectContaining({ reason: "Not satisfied" }), mockReq);
    expect(mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "order-1", status: "DELIVERED" }),
        data: expect.objectContaining({ status: "REFUNDED", payment_status: "REFUNDED" }),
      })
    );
    expect(mockTx.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED" }) })
    );
  });

  it("claims REFUNDED for a delivered COD order without a gateway refund", async () => {
    const order = makeOrder({ status: "DELIVERED", payment_method: "COD", payment_status: "PENDING" });
    repo.findById.mockResolvedValue(makeOrder({ status: "REFUNDED", payment_method: "COD" }));

    await refundOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq });

    expect(paymentServiceMock.refund).not.toHaveBeenCalled();
    expect(mockTx.order.updateMany).toHaveBeenCalled();
  });

  it("does not claim REFUNDED when the refund fails", async () => {
    const order = makeOrder({ status: "DELIVERED", payment_status: "PAID" });
    paymentServiceMock.refund.mockRejectedValue(new Error("refund gateway timeout"));

    await expect(
      refundOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq })
    ).rejects.toThrow("refund gateway timeout");
    expect(mockTx.order.updateMany).not.toHaveBeenCalled();
  });

  it("claims REFUNDED when the payment was already refunded (e.g. admin refunded first)", async () => {
    const order = makeOrder({ status: "DELIVERED", payment_status: "PAID" });
    paymentServiceMock.refund.mockRejectedValue(
      Object.assign(new Error("Payment has already been refunded."), { statusCode: 400, code: "ALREADY_REFUNDED" })
    );
    repo.findById.mockResolvedValue(makeOrder({ status: "REFUNDED", payment_status: "REFUNDED" }));

    const result = await refundOrderLifecycle({ order, reason: null, actorType: "admin", actorId: "a1", req: mockReq });

    expect(paymentServiceMock.refund).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("REFUNDED");
    expect(mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED", payment_status: "REFUNDED" }) })
    );
  });

  it("is idempotent for an already-refunded order", async () => {
    const order = makeOrder({ status: "REFUNDED" });

    const result = await refundOrderLifecycle({ order, reason: null, actorType: "customer", actorId: "u1", req: mockReq });

    expect(result.status).toBe("REFUNDED");
    expect(paymentServiceMock.refund).not.toHaveBeenCalled();
    expect(mockTx.order.updateMany).not.toHaveBeenCalled();
  });
});
