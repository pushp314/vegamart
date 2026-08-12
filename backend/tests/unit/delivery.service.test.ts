jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    order: { findMany: jest.fn(), findUnique: jest.fn() },
    deliveryTracking: { upsert: jest.fn() },
    deliveryProfile: { findUnique: jest.fn() },
    deliveryEarning: { aggregate: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    kycRecord: { upsert: jest.fn() },
  },
}));

jest.mock("../../src/repositories/delivery.repository", () => ({
  findByUserId: jest.fn(),
  updateDelivery: jest.fn(),
}));

jest.mock("../../src/repositories/order.repository", () => ({
  findById: jest.fn(),
  updateOrderStatus: jest.fn(),
}));

jest.mock("../../src/services/order-delivery.service", () => ({
  verifyDeliveryOtp: jest.fn(),
  completeDelivery: jest.fn(),
  DELIVERY_PARTNER_DELIVERY_STATES: ["PICKED_UP", "OUT_FOR_DELIVERY"],
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: { orderStatus: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/realtime/realtime", () => ({
  realtime: { publishOrderStatus: jest.fn(), publishOrderLocation: jest.fn() },
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as deliveryRepo from "../../src/repositories/delivery.repository";
import * as orderRepo from "../../src/repositories/order.repository";
import { deliveryService } from "../../src/services/delivery.service";
import {
  verifyDeliveryOtp,
  completeDelivery,
  DELIVERY_PARTNER_DELIVERY_STATES,
} from "../../src/services/order-delivery.service";
import { notificationService } from "../../src/services/notification.service";
import { realtime } from "../../src/realtime/realtime";

const deliveryRepoMock = deliveryRepo as jest.Mocked<typeof deliveryRepo>;
const orderRepoMock = orderRepo as jest.Mocked<typeof orderRepo>;
const verifyDeliveryOtpMock = verifyDeliveryOtp as jest.MockedFunction<typeof verifyDeliveryOtp>;
const completeDeliveryMock = completeDelivery as jest.MockedFunction<typeof completeDelivery>;

function makePartner(overrides: Record<string, unknown> = {}) {
  return { id: "p1", user_id: "u1", status: "APPROVED", is_available: false, ...overrides };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    order_number: "VM-1",
    user_id: "u-customer",
    vendor_id: "v1",
    delivery_partner_id: "p1",
    status: "PICKED_UP",
    otp_code: "123456",
    otp_expires_at: null,
    otp_attempts: 0,
    ...overrides,
  } as any;
}

describe("delivery service - delivery completion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateDeliveryStatus", () => {
    it("rejects 'delivered' so the generic status endpoint cannot bypass OTP", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder());

      await expect(
        deliveryService.updateDeliveryStatus("u1", "order-1", { status: "delivered" } as never)
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS" });
      expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalled();
    });

    it("rejects a backwards transition (e.g. PICKED_UP from an already DELIVERED order)", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder({ status: "DELIVERED" }));

      await expect(
        deliveryService.updateDeliveryStatus("u1", "order-1", { status: "picked_up" })
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS" });
      expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalled();
    });

    it("cannot skip PICKED_UP (jumping straight to OUT_FOR_DELIVERY is rejected)", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder({ status: "CONFIRMED" }));

      await expect(
        deliveryService.updateDeliveryStatus("u1", "order-1", { status: "out_for_delivery" })
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS" });
      expect(orderRepoMock.updateOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe("markDelivered", () => {
    it("refuses a delivery partner who is not assigned to the order", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder({ delivery_partner_id: "someone-else" }));

      await expect(
        deliveryService.markDelivered("u1", "order-1", { otp: "123456" } as any)
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(verifyDeliveryOtpMock).not.toHaveBeenCalled();
      expect(completeDeliveryMock).not.toHaveBeenCalled();
    });

    it("fails when OTP verification fails (no OTP accepted)", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder());
      verifyDeliveryOtpMock.mockRejectedValueOnce(Object.assign(new Error("Invalid delivery OTP."), { statusCode: 400, code: "INVALID_OTP" }));

      await expect(
        deliveryService.markDelivered("u1", "order-1", { otp: "000000" } as any)
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_OTP" });
      expect(completeDeliveryMock).not.toHaveBeenCalled();
    });

    it("completes delivery only with a verified OTP and for the assigned partner", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder());
      verifyDeliveryOtpMock.mockResolvedValue(undefined);
      completeDeliveryMock.mockResolvedValue({ id: "order-1", status: "DELIVERED" } as any);

      const updated = await deliveryService.markDelivered("u1", "order-1", { otp: "123456" } as any);

      expect(verifyDeliveryOtpMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "order-1", delivery_partner_id: "p1", status: "PICKED_UP" }),
        "123456",
        DELIVERY_PARTNER_DELIVERY_STATES
      );
      expect(completeDeliveryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          partnerId: "p1",
          otp: "123456",
          allowedStates: DELIVERY_PARTNER_DELIVERY_STATES,
          actorType: "delivery",
          actorId: "u1",
        })
      );
      expect(updated.status).toBe("DELIVERED");
      expect(notificationService.orderStatus).toHaveBeenCalledWith(
        "u-customer",
        "VM-1",
        "Order delivered",
        expect.stringContaining("delivered"),
        expect.objectContaining({ order_id: "order-1" })
      );
      expect(realtime.publishOrderStatus).toHaveBeenCalledWith("order-1", "DELIVERED");
    });
  });
});
