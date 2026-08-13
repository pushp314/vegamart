import { Prisma } from "@prisma/client";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    order: { findMany: jest.fn(), findUnique: jest.fn() },
    deliveryTracking: { upsert: jest.fn(), findUnique: jest.fn() },
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

jest.mock("../../src/repositories/address.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/repositories/vendor.repository", () => ({
  findById: jest.fn(),
  findByUserId: jest.fn(),
}));

jest.mock("../../src/repositories/user.repository", () => ({
  findById: jest.fn(),
  changeRole: jest.fn(),
  update: jest.fn(),
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

import prisma from "../../src/database/prisma";
import * as deliveryRepo from "../../src/repositories/delivery.repository";
import * as orderRepo from "../../src/repositories/order.repository";
import * as vendorRepo from "../../src/repositories/vendor.repository";
import * as userRepo from "../../src/repositories/user.repository";
import { deliveryService } from "../../src/services/delivery.service";
import {
  verifyDeliveryOtp,
  completeDelivery,
  DELIVERY_PARTNER_DELIVERY_STATES,
} from "../../src/services/order-delivery.service";
import { notificationService } from "../../src/services/notification.service";
import { realtime } from "../../src/realtime/realtime";

const db = prisma as any;
const deliveryRepoMock = deliveryRepo as jest.Mocked<typeof deliveryRepo>;
const orderRepoMock = orderRepo as jest.Mocked<typeof orderRepo>;
const vendorRepoMock = vendorRepo as jest.Mocked<typeof vendorRepo>;
const userRepoMock = userRepo as jest.Mocked<typeof userRepo>;
const verifyDeliveryOtpMock = verifyDeliveryOtp as jest.MockedFunction<typeof verifyDeliveryOtp>;
const completeDeliveryMock = completeDelivery as jest.MockedFunction<typeof completeDelivery>;

const mockTx = {
  order: { updateMany: jest.fn(), findUnique: jest.fn() },
  orderEvent: { create: jest.fn() },
};

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
    payment_method: "COD",
    payment_status: "PAID",
    address_id: "addr1",
    eta_minutes: null,
    total: new Prisma.Decimal(100),
    delivery_fee: new Prisma.Decimal(20),
    otp_code: "123456",
    otp_expires_at: null,
    otp_attempts: 0,
    ...overrides,
  } as any;
}

describe("delivery service - delivery completion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.$transaction.mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx));
    db.deliveryTracking.upsert.mockResolvedValue({ id: "t1" });
    db.deliveryTracking.findUnique.mockResolvedValue(null);
    db.deliveryProfile.findUnique.mockResolvedValue(null);
    mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockTx.order.findUnique.mockResolvedValue({ id: "order-1", order_number: "VM-1", status: "CONFIRMED", user_id: "u-customer" });
    mockTx.orderEvent.create.mockResolvedValue({ id: "ev1" });
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

  describe("acceptDelivery", () => {
    function stubAcceptOrder(status = "CONFIRMED") {
      orderRepoMock.findById.mockResolvedValue(
        makeOrder({ delivery_partner_id: null, status, payment_method: "COD", payment_status: "PAID" })
      );
    }

    it("atomically claims an unassigned order and only then records the assignment", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubAcceptOrder("CONFIRMED");

      const result = await deliveryService.acceptDelivery("u1", "order-1", 30, {} as any);

      expect(mockTx.order.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: "order-1",
          delivery_partner_id: null,
          status: { in: ["PENDING", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP"] },
        }),
        data: { delivery_partner_id: "p1", eta_minutes: 30 },
      });
      expect(mockTx.orderEvent.create).toHaveBeenCalled();
      expect(db.deliveryTracking.upsert).toHaveBeenCalled();
      expect(notificationService.orderStatus).toHaveBeenCalledWith(
        "u-customer",
        "VM-1",
        "Delivery partner assigned",
        expect.any(String),
        expect.objectContaining({ order_id: "order-1" })
      );
      expect(result).toEqual(expect.objectContaining({ id: "order-1", status: "CONFIRMED" }));
    });

    it("accepts only a COD payment in an upfront-unpaid state", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubAcceptOrder("CONFIRMED");
      orderRepoMock.findById.mockResolvedValue(
        makeOrder({ delivery_partner_id: null, status: "CONFIRMED", payment_method: "COD", payment_status: "PENDING" })
      );

      await expect(deliveryService.acceptDelivery("u1", "order-1", 30, {} as any)).resolves.toBeDefined();
      expect(mockTx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ payment_status: "PAID" }),
        })
      );
    });

    it("requires PAID in the atomic claim when payment is required upfront", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(
        makeOrder({ delivery_partner_id: null, status: "CONFIRMED", payment_method: "razorpay", payment_status: "PAID" })
      );

      await deliveryService.acceptDelivery("u1", "order-1", 30, {} as any);

      expect(mockTx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ payment_status: "PAID" }),
        })
      );
    });

    it("only lets one of two concurrent accepts win the claim", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubAcceptOrder("CONFIRMED");
      mockTx.order.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const results = await Promise.allSettled([
        deliveryService.acceptDelivery("u1", "order-1", 30, {} as any),
        deliveryService.acceptDelivery("u1", "order-1", 30, {} as any),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("rejects acceptance of a cancelled order", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubAcceptOrder("CANCELLED");

      await expect(deliveryService.acceptDelivery("u1", "order-1", 30, {} as any)).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_NOT_ACCEPTABLE",
      });
      expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    });

    it("rejects acceptance of an already DELIVERED order", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubAcceptOrder("DELIVERED");

      await expect(deliveryService.acceptDelivery("u1", "order-1", 30, {} as any)).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_NOT_ACCEPTABLE",
      });
      expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an unpaid order where payment is required upfront", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(
        makeOrder({ delivery_partner_id: null, status: "CONFIRMED", payment_method: "razorpay", payment_status: "PENDING" })
      );

      await expect(deliveryService.acceptDelivery("u1", "order-1", 30, {} as any)).rejects.toMatchObject({
        statusCode: 400,
        code: "ORDER_PAYMENT_REQUIRED",
      });
      expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    });

    it("rejects acceptance of an already assigned order", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      orderRepoMock.findById.mockResolvedValue(makeOrder({ delivery_partner_id: "p-other" }));

      await expect(deliveryService.acceptDelivery("u1", "order-1", 30, {} as any)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("getDeliveryTracking", () => {
    const customerA = { id: "customerA", role: "customer" };

    function stubTrackingOrder(overrides: Record<string, unknown> = {}) {
      orderRepoMock.findById.mockResolvedValue(
        makeOrder({ delivery_partner_id: "p1", status: "OUT_FOR_DELIVERY", ...overrides })
      );
    }

    it("customer A cannot access customer B's tracking", async () => {
      stubTrackingOrder({ user_id: "customerB" });

      await expect(
        deliveryService.getDeliveryTracking({ id: "customerA", role: "customer" }, "order-1")
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("a random authenticated user cannot access tracking by guessing an order id", async () => {
      stubTrackingOrder({ vendor_id: "vendorB", user_id: "someone" });
      vendorRepoMock.findByUserId.mockResolvedValue({ id: "vendorA" } as any);

      await expect(
        deliveryService.getDeliveryTracking({ id: "vendorA", role: "vendor" }, "order-1")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("lets a customer track their own order but never exposes driver PII", async () => {
      stubTrackingOrder({ user_id: "customerA" });
      db.deliveryProfile.findUnique.mockResolvedValue({
        id: "p1",
        user_id: "driverU",
        rating: 4.5,
        review_count: 3,
        vehicle_type: "bike",
        vehicle_number: "KA-01-AB-1234",
      });
      userRepoMock.findById.mockResolvedValue({ name: "Ravi", phone: "+919990001111" } as any);

      const result = await deliveryService.getDeliveryTracking(customerA, "order-1");

      expect(result).toEqual(expect.objectContaining({ order_id: "order-1" }));
      expect(result.driver_info).toBeNull();
      expect(db.deliveryProfile.findUnique).not.toHaveBeenCalled();
      expect(userRepoMock.findById).not.toHaveBeenCalled();
    });

    it("delivery partner may only track orders assigned to them", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubTrackingOrder({ delivery_partner_id: "p-other" });

      await expect(
        deliveryService.getDeliveryTracking({ id: "u1", role: "delivery" }, "order-1")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("delivery partner can track an order that is explicitly available (unassigned) to them", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubTrackingOrder({ delivery_partner_id: null, status: "CONFIRMED" });

      const result = await deliveryService.getDeliveryTracking({ id: "u1", role: "delivery" }, "order-1");

      expect(result.driver_info).toBeNull();
      expect(result.order_id).toBe("order-1");
    });

    it("assigned delivery partner sees their own driver info", async () => {
      deliveryRepoMock.findByUserId.mockResolvedValue(makePartner() as any);
      stubTrackingOrder({ delivery_partner_id: "p1" });
      db.deliveryProfile.findUnique.mockResolvedValue({
        id: "p1",
        user_id: "driverU",
        rating: 4.7,
        review_count: 12,
        vehicle_type: "scooter",
        vehicle_number: "KA-05",
      });
      userRepoMock.findById.mockResolvedValue({ name: "Ravi", phone: "+919990001111" } as any);

      const result = await deliveryService.getDeliveryTracking({ id: "u1", role: "delivery" }, "order-1");

      expect(result.driver_info).toEqual(
        expect.objectContaining({ name: "Ravi", phone: "+919990001111", vehicle_number: "KA-05" })
      );
    });

    it("the owning vendor can track and sees driver info", async () => {
      stubTrackingOrder({ vendor_id: "v1", delivery_partner_id: "p1" });
      vendorRepoMock.findByUserId.mockResolvedValue({ id: "v1" } as any);
      db.deliveryProfile.findUnique.mockResolvedValue({ id: "p1", user_id: "driverU", vehicle_type: "bike" });
      userRepoMock.findById.mockResolvedValue({ name: "Ravi", phone: null } as any);

      const result = await deliveryService.getDeliveryTracking({ id: "vendorOwner", role: "vendor" }, "order-1");

      expect(result.driver_info).toEqual(expect.objectContaining({ name: "Ravi" }));
    });
  });

  describe("listDeliveryRequests", () => {
    it("handles an order with a missing address without crashing", async () => {
      db.order.findMany.mockResolvedValue([
        {
          id: "o1",
          order_number: "VM-1",
          delivery_fee: new Prisma.Decimal(20),
          total: new Prisma.Decimal(100),
          created_at: new Date(),
          vendor: { business_name: "Sharma Store", address: "x", city: "Bengaluru" },
          customer: { id: "u1", name: "A", phone: "1" },
          address: null,
        },
      ]);

      const rows = await deliveryService.listDeliveryRequests();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: "o1", order_number: "VM-1" });
      expect(rows[0]!.address).toBeNull();
      expect(rows[0]!.vendor).toEqual(expect.objectContaining({ business_name: "Sharma Store" }));
    });

    it("returns null vendor/customer for orders without a vendor or customer relation", async () => {
      db.order.findMany.mockResolvedValue([
        {
          id: "o2",
          order_number: "VM-2",
          delivery_fee: new Prisma.Decimal(15),
          total: new Prisma.Decimal(80),
          created_at: new Date(),
          vendor: null,
          customer: null,
          address: { full_address: "12 MG Road", city: "Bengaluru", state: "KA", pincode: "560001" },
        },
      ]);

      const rows = await deliveryService.listDeliveryRequests();

      expect(rows).toHaveLength(1);
      expect(rows[0]!.vendor).toBeNull();
      expect(rows[0]!.user).toBeNull();
      expect(rows[0]!.address).toEqual(
        expect.objectContaining({ street_address: "12 MG Road", city: "Bengaluru" }),
      );
    });
  });
});
