import { createRealtimeTicket, consumeRealtimeTicket } from "../../src/services/realtime-ticket.service";
import { realtime } from "../../src/realtime/realtime";

describe("Realtime & WebSocket Ticket Service", () => {
  describe("WS Ticket Generation and Consumption", () => {
    it("generates a valid ticket and consumes it once", async () => {
      const user = { id: "user-1234-uuid", role: "customer", email: "test@vegamart.in" };
      const ticket = await createRealtimeTicket(user);

      expect(typeof ticket).toBe("string");
      expect(ticket.length).toBeGreaterThanOrEqual(32);

      // Consume first time: should succeed
      const payload = await consumeRealtimeTicket(ticket);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe("user-1234-uuid");
      expect(payload?.role).toBe("customer");

      // Consume second time (single-use guarantee): should be null
      const secondAttempt = await consumeRealtimeTicket(ticket);
      expect(secondAttempt).toBeNull();
    });

    it("returns null for non-existent or invalid tickets", async () => {
      const result = await consumeRealtimeTicket("invalid-non-existent-ticket-string");
      expect(result).toBeNull();
    });
  });

  describe("Subscriber Counting & Room Isolation", () => {
    it("reports 0 subscribers for empty rooms", () => {
      const count = realtime.getSubscriberCount("order:non-existent-room-id");
      expect(count).toBe(0);
    });

    it("reports 0 tracking subscribers when room has no active listeners", () => {
      const count = realtime.getOrderTrackingSubscriberCount("master-order-empty-123");
      expect(count).toBe(0);
    });
  });
});
