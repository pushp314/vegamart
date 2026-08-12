import { paymentService } from "../../src/services/payment.service";

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: {
    send: jest.fn(),
    orderStatus: jest.fn(),
    payment: jest.fn().mockResolvedValue(undefined),
    vendor: jest.fn(),
  },
}));

jest.mock("../../src/repositories/payment.repository", () => ({
  findByRazorpayOrderId: jest.fn(),
  findById: jest.fn(),
  findByOrderId: jest.fn(),
  updatePayment: jest.fn(),
  createForOrder: jest.fn(),
  incrementAttempts: jest.fn(),
  claimAsPaid: jest.fn(),
}));

jest.mock("../../src/repositories/order.repository", () => ({
  findById: jest.fn(),
  updateOrder: jest.fn(),
  updateOrderStatus: jest.fn(),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  reserveQuantityFromOrder: jest.fn(),
  releaseQuantityForOrder: jest.fn(),
}));

jest.mock("../../src/repositories/transaction.repository", () => ({
  create: jest.fn(),
}));

jest.mock("../../src/payments/razorpay.gateway", () => ({
  razorpayGateway: {
    verifySignature: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    refundPayment: jest.fn(),
    fetchPayment: jest.fn(),
  },
}));

jest.mock("../../src/database/cache", () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

import * as paymentRepo from "../../src/repositories/payment.repository";
import * as orderRepo from "../../src/repositories/order.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import * as transactionRepo from "../../src/repositories/transaction.repository";
import { razorpayGateway } from "../../src/payments/razorpay.gateway";

const payRepo = paymentRepo as jest.Mocked<typeof paymentRepo>;
const orderRepoMock = orderRepo as jest.Mocked<typeof orderRepo>;
const invRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;
const txRepo = transactionRepo as jest.Mocked<typeof transactionRepo>;
const gatewayMock = razorpayGateway as jest.Mocked<typeof razorpayGateway>;

const mockReq = { user: { id: "u1" } } as any;

function dec(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) } as any;
}

function makePayment(overrides: Partial<paymentRepo.PaymentRow> = {}): paymentRepo.PaymentRow {
  return {
    id: "pay-1",
    order_id: "order-1",
    razorpay_order_id: "rzp-order-1",
    razorpay_payment_id: "rzp-pay-1",
    razorpay_signature: null,
    method: "RAZORPAY",
    amount: dec(240),
    status: "PENDING",
    currency: "INR",
    attempts: 0,
    failure_reason: null,
    refund_id: null,
    refund_amount: null,
    refund_status: null,
    gateway_response: null,
    webhook_events: null,
    idempotency_key: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<orderRepo.OrderRow> = {}) {
  return {
    id: "order-1",
    order_number: "GC-1",
    user_id: "u1",
    vendor_id: "v1",
    status: "PENDING",
    payment_status: "PENDING",
    payment_method: "RAZORPAY",
    items_subtotal: dec(200),
    delivery_fee: dec(30),
    discount: dec(0),
    tax: dec(10),
    total: dec(240),
    ...overrides,
  } as any;
}

function capturedEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: "rzp-pay-1",
    entity: "payment",
    order_id: "rzp-order-1",
    status: "captured",
    amount: 24000,
    currency: "INR",
    method: "upi",
    created_at: 1720000000,
    ...overrides,
  };
}

describe("payment service - verifyPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects verification when the signature is invalid", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(false);

    await expect(
      paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "bad" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_SIGNATURE" });
    expect(gatewayMock.fetchPayment).not.toHaveBeenCalled();
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
  });

  it("verifies a payment only when signature, amount, currency and order mapping all match", async () => {
    payRepo.findByRazorpayOrderId
      .mockResolvedValueOnce(makePayment())
      .mockResolvedValue(makePayment({ status: "PAID" }));
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockResolvedValue(capturedEntity());
    payRepo.claimAsPaid.mockResolvedValue(1);
    orderRepoMock.updateOrder.mockResolvedValue(makeOrder({ payment_status: "PAID" }));
    orderRepoMock.updateOrderStatus.mockResolvedValue(makeOrder({ status: "CONFIRMED" }));

    const result = await paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq);

    expect(result.payment.status).toBe("PAID");
    expect(payRepo.claimAsPaid).toHaveBeenCalledWith(
      "pay-1",
      expect.objectContaining({ razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" })
    );
    expect(orderRepoMock.updateOrder).toHaveBeenCalledWith("order-1", { payment_status: "PAID" });
    expect(orderRepoMock.updateOrderStatus).toHaveBeenCalledWith("order-1", expect.objectContaining({ status: "CONFIRMED" }));
    expect(txRepo.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 240, reference: "rzp-pay-1" }));
    expect(invRepo.reserveQuantityFromOrder).toHaveBeenCalledWith("order-1", mockReq);
  });

  it("rejects a captured amount that does not match the order total", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockResolvedValue(capturedEntity({ amount: 24001 }));

    await expect(
      paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_AMOUNT_MISMATCH" });
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
    expect(orderRepoMock.updateOrder).not.toHaveBeenCalled();
    expect(txRepo.create).not.toHaveBeenCalled();
  });

  it("rejects a payment whose currency does not match the order", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockResolvedValue(capturedEntity({ currency: "USD" }));

    await expect(
      paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_CURRENCY_MISMATCH" });
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
  });

  it("rejects a payment that does not belong to the expected order", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockResolvedValue(capturedEntity({ order_id: "rzp-order-other" }));

    await expect(
      paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_ORDER_MISMATCH" });
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
  });

  it("rejects a payment with an unacceptable gateway status", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockResolvedValue(capturedEntity({ status: "failed" }));

    await expect(
      paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_STATUS_NOT_ACCEPTABLE" });
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
  });

  it("rejects when the gateway cannot be reached (payment stays unpaid)", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockRejectedValue(new Error("network down"));

    await expect(
      paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 502, code: "PAYMENT_VERIFICATION_FAILED" });
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
    expect(txRepo.create).not.toHaveBeenCalled();
  });

  it("is idempotent: a duplicate callback after success does not re-run side effects", async () => {
    payRepo.findByRazorpayOrderId
      .mockResolvedValueOnce(makePayment())
      .mockResolvedValue(makePayment({ status: "PAID" }));
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    gatewayMock.verifySignature.mockReturnValue(true);
    gatewayMock.fetchPayment.mockResolvedValue(capturedEntity());
    payRepo.claimAsPaid.mockResolvedValue(0); // a concurrent request already won the claim

    const result = await paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "good" }, mockReq);

    expect(result.payment.status).toBe("PAID");
    expect(txRepo.create).not.toHaveBeenCalled();
    expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalled();
    expect(invRepo.reserveQuantityFromOrder).not.toHaveBeenCalled();
  });

  it("is idempotent: refreshing/retrying an already-paid payment returns early", async () => {
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment({ status: "PAID" }));
    orderRepoMock.findById.mockResolvedValue(makeOrder());

    const result = await paymentService.verifyPayment("u1", { razorpay_order_id: "rzp-order-1", razorpay_payment_id: "rzp-pay-1", razorpay_signature: "x" }, mockReq);

    expect(result.payment.status).toBe("PAID");
    expect(gatewayMock.verifySignature).not.toHaveBeenCalled();
    expect(txRepo.create).not.toHaveBeenCalled();
    expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalled();
  });
});

describe("payment service - webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects webhooks with a missing or invalid signature", async () => {
    await expect(paymentService.handleWebhook("{}", undefined, mockReq)).rejects.toMatchObject({ statusCode: 401 });
    gatewayMock.verifyWebhookSignature.mockReturnValue(false);
    await expect(paymentService.handleWebhook("{}", "sig", mockReq)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("processes a valid payment.captured webhook", async () => {
    gatewayMock.verifyWebhookSignature.mockReturnValue(true);
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    payRepo.claimAsPaid.mockResolvedValue(1);

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: capturedEntity() } },
    });
    const result = await paymentService.handleWebhook(body, "sig", mockReq);
    expect(result.handled).toBe("payment.captured");
    expect(txRepo.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 240, reference: "rzp-pay-1" }));
    expect(orderRepoMock.updateOrderStatus).toHaveBeenCalledWith("order-1", expect.objectContaining({ status: "CONFIRMED" }));
    expect(invRepo.reserveQuantityFromOrder).toHaveBeenCalledWith("order-1", undefined);
  });

  it("rejects a payment.captured webhook whose amount does not match the order", async () => {
    gatewayMock.verifyWebhookSignature.mockReturnValue(true);
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());
    orderRepoMock.findById.mockResolvedValue(makeOrder());

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: capturedEntity({ amount: 24001 }) } },
    });
    await expect(paymentService.handleWebhook(body, "sig", mockReq)).rejects.toMatchObject({
      statusCode: 400,
      code: "PAYMENT_AMOUNT_MISMATCH",
    });
    expect(payRepo.claimAsPaid).not.toHaveBeenCalled();
    expect(txRepo.create).not.toHaveBeenCalled();
  });

  it("does not duplicate side effects when the webhook races the client callback", async () => {
    gatewayMock.verifyWebhookSignature.mockReturnValue(true);
    payRepo.findByRazorpayOrderId.mockResolvedValue(makePayment({ status: "PAID" }));
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    payRepo.claimAsPaid.mockResolvedValue(0);

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: capturedEntity() } },
    });
    const result = await paymentService.handleWebhook(body, "sig", mockReq);
    expect(result.handled).toBe("payment.captured");
    expect(txRepo.create).not.toHaveBeenCalled();
    expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalled();
  });
});

describe("payment service - refund", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects refunding a payment that is not paid", async () => {
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    payRepo.findByOrderId.mockResolvedValue(makePayment({ status: "PENDING" }));

    await expect(paymentService.refund("admin-1", "order-1", {}, mockReq)).rejects.toMatchObject({
      statusCode: 400,
      code: "NOT_PAID",
    });
  });

  it("refunds a paid payment", async () => {
    orderRepoMock.findById.mockResolvedValue(makeOrder());
    payRepo.findByOrderId.mockResolvedValue(makePayment({ status: "PAID" }));
    gatewayMock.refundPayment.mockResolvedValue({ id: "ref-1", status: "processed" });
    payRepo.updatePayment.mockResolvedValue(makePayment({ status: "REFUNDED", refund_id: "ref-1" }));

    const result = (await paymentService.refund("admin-1", "order-1", {}, mockReq)) as { refund_id: string; status: string };
    expect(result.refund_id).toBe("ref-1");
    expect(invRepo.releaseQuantityForOrder).toHaveBeenCalledWith("order-1");
    expect(orderRepoMock.updateOrderStatus).toHaveBeenCalledWith("order-1", expect.objectContaining({ status: "REFUNDED" }));
  });
});
