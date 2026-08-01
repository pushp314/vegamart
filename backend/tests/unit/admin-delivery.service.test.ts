import { Prisma } from "@prisma/client";

import { adminDeliveryService } from "../../src/services/admin-delivery.service";

jest.mock("../../src/repositories/delivery.repository", () => ({
  findById: jest.fn(),
  listDeliveryPartners: jest.fn(),
  updateDelivery: jest.fn(),
  getDetail: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as deliveryRepo from "../../src/repositories/delivery.repository";

const repo = deliveryRepo as jest.Mocked<typeof deliveryRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

function makePartner(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    user_id: "u2",
    vehicle_type: "bike",
    vehicle_number: "DL-01-AB-1234",
    license_number: "DL123",
    status: "PENDING",
    is_verified: false,
    is_available: false,
    availability_status: "OFFLINE",
    current_lat: null,
    current_lng: null,
    rating: 0,
    review_count: 0,
    rejection_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("admin delivery service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("lists delivery partners with filters", async () => {
    repo.listDeliveryPartners.mockResolvedValue({
      rows: [makePartner() as any],
      total: 1,
    });

    const result = await adminDeliveryService.list({ page: 1, per_page: 20, status: "PENDING" });

    expect(repo.listDeliveryPartners).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING" }),
      expect.any(Number),
      expect.any(Number)
    );
    expect(result.total).toBe(1);
  });

  it("approves a delivery partner", async () => {
    repo.findById.mockResolvedValue(makePartner() as any);
    repo.updateDelivery.mockResolvedValue(makePartner({ status: "APPROVED", is_verified: true }) as any);

    const result = await adminDeliveryService.review("admin-1", "d1", "approve", null, mockReq);

    expect(repo.updateDelivery).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ status: "APPROVED", is_verified: true, rejection_reason: null })
    );
    expect(result.status).toBe("APPROVED");
  });

  it("suspends a delivery partner and marks them offline", async () => {
    repo.findById.mockResolvedValue(makePartner({ status: "APPROVED" }) as any);
    repo.updateDelivery.mockResolvedValue(makePartner({ status: "SUSPENDED" }) as any);

    await adminDeliveryService.suspend("admin-1", "d1", "Policy violation", mockReq);

    expect(repo.updateDelivery).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({
        status: "SUSPENDED",
        is_available: false,
        availability_status: "OFFLINE",
        rejection_reason: "Policy violation",
      })
    );
  });

  it("restores a suspended delivery partner", async () => {
    repo.findById.mockResolvedValue(makePartner({ status: "SUSPENDED" }) as any);
    repo.updateDelivery.mockResolvedValue(makePartner({ status: "APPROVED" }) as any);

    const result = await adminDeliveryService.restore("admin-1", "d1", mockReq);

    expect(result.status).toBe("APPROVED");
    expect(repo.updateDelivery).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ status: "APPROVED", is_verified: true })
    );
  });

  it("returns detail with earnings stats", async () => {
    repo.getDetail.mockResolvedValue({
      ...makePartner({ status: "APPROVED" }),
      user: { id: "u2", name: "Raj", email: "raj@example.com", phone: null, avatar_url: null, status: "ACTIVE", is_verified: true, created_at: new Date() },
      stats: {
        total_deliveries: 12,
        active_deliveries: 1,
        total_earnings: new Prisma.Decimal(600),
        pending_earnings: new Prisma.Decimal(100),
      },
    } as any);

    const result = await adminDeliveryService.getById("d1");

    expect(result.stats.total_deliveries).toBe(12);
    expect(result.user.email).toBe("raj@example.com");
  });

  it("throws NOT_FOUND for a missing partner", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(adminDeliveryService.review("admin-1", "d1", "approve", null, mockReq)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
