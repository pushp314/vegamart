import { OTP_MAX_ATTEMPTS } from "../../src/constants";

const mockPrismaTx = {
  order: { updateMany: jest.fn(), findUnique: jest.fn() },
  orderEvent: { create: jest.fn() },
  deliveryTracking: { upsert: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(async (cb: (tx: any) => unknown) => cb(mockPrismaTx)),
  order: { updateMany: jest.fn() },
};

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  consumeQuantityForOrder: jest.fn().mockResolvedValue(undefined),
}));

import prisma from "../../src/database/prisma";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import {
  assertValidDeliveryOtp,
  verifyDeliveryOtp,
  completeDelivery,
  DELIVERY_PARTNER_DELIVERY_STATES,
  VENDOR_DELIVERY_STATES,
  type DeliveryOtpOrder,
} from "../../src/services/order-delivery.service";

const invRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;

function makeOrder(overrides: Partial<DeliveryOtpOrder> = {}): DeliveryOtpOrder {
  return {
    id: "order-1",
    status: "PICKED_UP",
    otp_code: "123456",
    otp_expires_at: null,
    otp_attempts: 0,
    ...overrides,
  };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return { id: "order-1", status: "DELIVERED", otp_code: null, ...overrides };
}

describe("assertValidDeliveryOtp", () => {
  it("accepts a 6-digit OTP", () => {
    expect(() => assertValidDeliveryOtp("123456")).not.toThrow();
  });

  it("rejects a 4-digit OTP", () => {
    expect(() => assertValidDeliveryOtp("1234")).toThrow();
    expect(() => assertValidDeliveryOtp("1234")).toThrow(/6 digits/);
  });

  it("rejects non-numeric or longer OTPs", () => {
    expect(() => assertValidDeliveryOtp("abcdef")).toThrow();
    expect(() => assertValidDeliveryOtp("1234567")).toThrow();
  });
});

describe("verifyDeliveryOtp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a non-6-digit OTP without touching the attempt counter", async () => {
    await expect(
      verifyDeliveryOtp(makeOrder(), "1234", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "INVALID_OTP" });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects delivery from a state that is not completable (cannot skip PICKED_UP)", async () => {
    await expect(
      verifyDeliveryOtp(makeOrder({ status: "CONFIRMED" }), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "INVALID_DELIVERY_STATE" });
    await expect(
      verifyDeliveryOtp(makeOrder({ status: "READY_FOR_PICKUP" }), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "INVALID_DELIVERY_STATE" });
    // Vendors may complete from READY_FOR_PICKUP (self-delivery hand-over)
    await expect(
      verifyDeliveryOtp(makeOrder({ status: "READY_FOR_PICKUP" }), "123456", VENDOR_DELIVERY_STATES)
    ).resolves.toBeUndefined();
  });

  it("rejects when no OTP is set for the order", async () => {
    await expect(
      verifyDeliveryOtp(makeOrder({ otp_code: null }), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "INVALID_OTP" });
  });

  it("rejects an expired OTP", async () => {
    const expired = new Date(Date.now() - 60_000);
    await expect(
      verifyDeliveryOtp(makeOrder({ otp_expires_at: expired }), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "OTP_EXPIRED" });
  });

  it("rejects once the failed-attempt budget is exhausted", async () => {
    await expect(
      verifyDeliveryOtp(makeOrder({ otp_attempts: OTP_MAX_ATTEMPTS }), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "OTP_ATTEMPTS_EXCEEDED" });
  });

  it("increments attempts atomically (bounded) and rejects a wrong OTP", async () => {
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      verifyDeliveryOtp(makeOrder({ otp_code: "999999" }), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).rejects.toMatchObject({ code: "INVALID_OTP" });

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", otp_attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { otp_attempts: { increment: 1 } },
    });
  });

  it("accepts a correct 6-digit OTP", async () => {
    await expect(
      verifyDeliveryOtp(makeOrder(), "123456", DELIVERY_PARTNER_DELIVERY_STATES)
    ).resolves.toBeUndefined();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});

describe("completeDelivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks the order DELIVERED, invalidates the OTP, and consumes inventory once in one transaction", async () => {
    mockPrismaTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaTx.order.findUnique.mockResolvedValue(makeRow());

    const result = await completeDelivery({
      orderId: "order-1",
      otp: "123456",
      allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
      actorType: "delivery",
      actorId: "u1",
    });

    expect(mockPrismaTx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        status: { in: [...DELIVERY_PARTNER_DELIVERY_STATES] },
        otp_code: "123456",
      },
      data: expect.objectContaining({
        status: "DELIVERED",
        otp_code: null,
        otp_expires_at: null,
        otp_attempts: 0,
        delivered_at: expect.any(Date),
      }),
    });
    expect(invRepo.consumeQuantityForOrder).toHaveBeenCalledWith("order-1", mockPrismaTx);
    expect(mockPrismaTx.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DELIVERED",
          actor_type: "delivery",
          actor_id: "u1",
        }),
      })
    );
    expect(mockPrismaTx.deliveryTracking.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { order_id: "order-1" }, update: { status: "DELIVERED" } })
    );
    expect(result.status).toBe("DELIVERED");
  });

  it("does not consume inventory when the atomic claim fails (already delivered / skipped state)", async () => {
    mockPrismaTx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      completeDelivery({
        orderId: "order-1",
        otp: "123456",
        allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
        actorType: "delivery",
        actorId: "u1",
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_DELIVERY_STATE" });

    expect(invRepo.consumeQuantityForOrder).not.toHaveBeenCalled();
    expect(mockPrismaTx.orderEvent.create).not.toHaveBeenCalled();
  });

  it("repeated completion does not consume inventory twice", async () => {
    mockPrismaTx.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mockPrismaTx.order.findUnique.mockResolvedValue(makeRow());

    await completeDelivery({
      orderId: "order-1",
      otp: "123456",
      allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
      actorType: "delivery",
      actorId: "u1",
    });
    await expect(
      completeDelivery({
        orderId: "order-1",
        otp: "123456",
        allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
        actorType: "delivery",
        actorId: "u1",
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(invRepo.consumeQuantityForOrder).toHaveBeenCalledTimes(1);
  });

  it("scopes the atomic claim to the assigned delivery partner", async () => {
    mockPrismaTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaTx.order.findUnique.mockResolvedValue(makeRow());

    await completeDelivery({
      orderId: "order-1",
      partnerId: "p1",
      otp: "123456",
      allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
      actorType: "delivery",
      actorId: "u1",
    });

    expect(mockPrismaTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ delivery_partner_id: "p1" }) })
    );
  });
});
