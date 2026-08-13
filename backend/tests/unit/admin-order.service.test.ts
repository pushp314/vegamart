import { adminOrderService } from "../../src/services/admin-order.service";

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: { order: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() } },
}));

jest.mock("../../src/repositories/order.repository", () => ({
  findById: jest.fn(),
  updateOrderStatus: jest.fn(),
}));

jest.mock("../../src/services/order-lifecycle.service", () => ({
  assertOrderTransition: jest.fn(),
  cancelOrderLifecycle: jest.fn(),
  refundOrderLifecycle: jest.fn(),
}));

jest.mock("../../src/services/order-delivery.service", () => ({
  completeDelivery: jest.fn(),
}));

import prisma from "../../src/database/prisma";
import * as orderRepo from "../../src/repositories/order.repository";
import {
  assertOrderTransition,
  cancelOrderLifecycle,
  refundOrderLifecycle,
} from "../../src/services/order-lifecycle.service";
import { completeDelivery } from "../../src/services/order-delivery.service";
import { auditService } from "../../src/services/audit.service";

const db = prisma as any;
const repo = orderRepo as jest.Mocked<typeof orderRepo>;
const assertTransitionMock = assertOrderTransition as jest.MockedFunction<typeof assertOrderTransition>;
const cancelLifecycleMock = cancelOrderLifecycle as jest.MockedFunction<typeof cancelOrderLifecycle>;
const refundLifecycleMock = refundOrderLifecycle as jest.MockedFunction<typeof refundOrderLifecycle>;
const completeDeliveryMock = completeDelivery as jest.MockedFunction<typeof completeDelivery>;
const auditMock = auditService as jest.Mocked<typeof auditService>;

const mockReq = { user: { id: "admin-1" } } as any;

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    order_number: "GC-1",
    user_id: "u1",
    vendor_id: "v1",
    status: "PENDING",
    payment_status: "PENDING",
    payment_method: "RAZORPAY",
    deleted_at: null,
    ...overrides,
  } as any;
}

describe("admin order service - updateStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.order.findFirst.mockResolvedValue(makeOrder());
  });

  it("rejects a transition the state machine does not allow", async () => {
    assertTransitionMock.mockImplementation(() => {
      throw Object.assign(new Error("Cannot transition order from PENDING to DELIVERED."), {
        statusCode: 400,
        code: "INVALID_STATUS",
      });
    });
    db.order.findFirst.mockResolvedValue(makeOrder({ status: "PENDING" }));

    await expect(
      adminOrderService.updateStatus("admin-1", "order-1", "DELIVERED", null, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS" });
    expect(cancelLifecycleMock).not.toHaveBeenCalled();
    expect(completeDeliveryMock).not.toHaveBeenCalled();
  });

  it("is idempotent when the target equals the current status", async () => {
    db.order.findFirst.mockResolvedValue(makeOrder({ status: "DELIVERED" }));

    const result = await adminOrderService.updateStatus("admin-1", "order-1", "DELIVERED", null, mockReq);

    expect(result.status).toBe("DELIVERED");
    expect(assertTransitionMock).not.toHaveBeenCalled();
    expect(cancelLifecycleMock).not.toHaveBeenCalled();
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("routes CANCELLED through the refund-first cancel lifecycle", async () => {
    assertTransitionMock.mockReturnValue(undefined);
    repo.findById.mockResolvedValue(makeOrder({ status: "CONFIRMED", payment_status: "PAID" }) as any);
    cancelLifecycleMock.mockResolvedValue(makeOrder({ status: "CANCELLED" }) as any);

    const result = await adminOrderService.updateStatus("admin-1", "order-1", "CANCELLED", "Fraud order", mockReq);

    expect(cancelLifecycleMock).toHaveBeenCalledWith({
      order: expect.objectContaining({ id: "order-1" }),
      reason: "Fraud order",
      actorType: "admin",
      actorId: "admin-1",
      req: mockReq,
    });
    expect(result.status).toBe("CANCELLED");
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ newValues: { status: "CANCELLED", reason: "Fraud order" } }),
      mockReq
    );
  });

  it("routes REFUNDED through the refund lifecycle", async () => {
    assertTransitionMock.mockReturnValue(undefined);
    repo.findById.mockResolvedValue(makeOrder({ status: "DELIVERED", payment_status: "PAID" }) as any);
    refundLifecycleMock.mockResolvedValue(makeOrder({ status: "REFUNDED" }) as any);

    await adminOrderService.updateStatus("admin-1", "order-1", "REFUNDED", null, mockReq);

    expect(refundLifecycleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ status: "DELIVERED" }),
        actorType: "admin",
        actorId: "admin-1",
        req: mockReq,
      })
    );
  });

  it("routes DELIVERED through completeDelivery with skipOtp so side effects run", async () => {
    assertTransitionMock.mockReturnValue(undefined);
    completeDeliveryMock.mockResolvedValue(makeOrder({ status: "DELIVERED" }) as any);

    await adminOrderService.updateStatus("admin-1", "order-1", "DELIVERED", "Manual override", mockReq);

    expect(completeDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        actorType: "admin",
        actorId: "admin-1",
        skipOtp: true,
      })
    );
  });

  it("applies a plain machine-validated transition for other statuses", async () => {
    assertTransitionMock.mockReturnValue(undefined);
    repo.updateOrderStatus.mockResolvedValue(makeOrder({ status: "CONFIRMED" }) as any);

    const result = await adminOrderService.updateStatus("admin-1", "order-1", "CONFIRMED", null, mockReq);

    expect(assertTransitionMock).toHaveBeenCalledWith("PENDING", "CONFIRMED");
    expect(repo.updateOrderStatus).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ status: "CONFIRMED", actorType: "admin", actorId: "admin-1" })
    );
    expect(result.status).toBe("CONFIRMED");
  });
});
