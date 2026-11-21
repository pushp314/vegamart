import { trackingService } from "../../src/modules/tracking/tracking.service";
import prisma from "../../src/database/prisma";
import { realtime } from "../../src/realtime/realtime";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    deliveryProfile: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: "p1" }),
    },
    masterOrder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([{ id: "sub-1" }]),
      update: jest.fn().mockResolvedValue({ id: "sub-1" }),
    },
    deliveryTracking: {
      upsert: jest.fn().mockResolvedValue({ id: "dt1" }),
    },
  },
}));

jest.mock("../../src/realtime/realtime", () => ({
  realtime: {
    getOrderTrackingSubscriberCount: jest.fn(),
    publishTrackingUpdate: jest.fn(),
    publishOrderStatus: jest.fn(),
  },
}));

jest.mock("../../src/modules/tracking/route.provider", () => ({
  routingService: {
    calculateRoute: jest.fn().mockResolvedValue({
      points: [
        [12.9716, 77.5946],
        [12.9720, 77.5950],
        [12.9730, 77.5960],
      ],
      distanceMeters: 500,
      durationSeconds: 120,
      provider: "haversine",
    }),
  },
}));

const db = prisma as any;
const realtimeMock = realtime as jest.Mocked<typeof realtime>;

describe("Tracking Service - Resource Protection on 1 vCPU VPS", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    db.deliveryProfile.findFirst.mockImplementation((args: any) => {
      const userId = args.where.user_id;
      return Promise.resolve({
        id: `partner-${userId}`,
        is_available: true,
      });
    });

    db.masterOrder.findMany.mockImplementation((args: any) => {
      const partnerId = args.where.delivery_partner_id;
      return Promise.resolve([
        {
          id: `mo-${partnerId}`,
          status: "OUT_FOR_DELIVERY",
          delivery_partner_id: partnerId,
          delivery_address: {
            latitude: 12.9730,
            longitude: 77.5960,
            street_address: "Destination Rd",
          },
          orders: [
            {
              id: "sub-1",
              status: "OUT_FOR_DELIVERY",
              delivery_partner_id: partnerId,
              vendor: {
                latitude: 12.9716,
                longitude: 77.5946,
                business_name: "Fresh Store",
              },
            },
          ],
        },
      ]);
    });
  });

  it("skips WebSocket broadcast when room has 0 subscribers", async () => {
    realtimeMock.getOrderTrackingSubscriberCount.mockReturnValue(0);

    const result = await trackingService.ingestLocation("user-zero-subscribers", {
      lat: 12.9716,
      lng: 77.5946,
      accuracy: 10,
      sequence: 1,
    });

    expect(result.success).toBe(true);
    expect(realtimeMock.getOrderTrackingSubscriberCount).toHaveBeenCalledWith("mo-partner-user-zero-subscribers");
    // Verifies 0-subscriber skip: no JSON serialization or WS write
    expect(realtimeMock.publishTrackingUpdate).not.toHaveBeenCalled();
  });

  it("broadcasts over WebSocket when room has >= 1 subscriber", async () => {
    realtimeMock.getOrderTrackingSubscriberCount.mockReturnValue(2);

    const result = await trackingService.ingestLocation("user-with-subscribers", {
      lat: 12.9717,
      lng: 77.5947,
      accuracy: 10,
      sequence: 1,
    });

    expect(result.success).toBe(true);
    expect(realtimeMock.getOrderTrackingSubscriberCount).toHaveBeenCalledWith("mo-partner-user-with-subscribers");
    expect(realtimeMock.publishTrackingUpdate).toHaveBeenCalledWith(
      "mo-partner-user-with-subscribers",
      expect.objectContaining({
        lat: 12.9717,
        lng: 77.5947,
        staleAfterSec: 45,
      })
    );
  });

  it("skips PostgreSQL write when less than 45s has elapsed since last DB persist", async () => {
    realtimeMock.getOrderTrackingSubscriberCount.mockReturnValue(1);
    const userId = "user-db-throttle";

    // 1st ping: triggers DB persist
    const ping1 = await trackingService.ingestLocation(userId, {
      lat: 12.9716,
      lng: 77.5946,
      accuracy: 8,
      sequence: 1,
    });
    expect(ping1.success).toBe(true);
    expect(db.deliveryProfile.update).toHaveBeenCalledTimes(1);

    // Wait > 2s to clear rate limiter, but < 45s
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // 2nd ping (3 seconds later): hot state in Redis/memory is updated, but DB write is SKIPPED
    const ping2 = await trackingService.ingestLocation(userId, {
      lat: 12.9720,
      lng: 77.5950,
      accuracy: 8,
      sequence: 2,
    });
    expect(ping2.success).toBe(true);

    // DB update call count should STILL be 1 (0 additional PostgreSQL writes!)
    expect(db.deliveryProfile.update).toHaveBeenCalledTimes(1);
  }, 10000);
});
