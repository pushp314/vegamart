import {
  haversineDistanceMeters,
  calculateBearing,
  normalizeCoordinates,
  normalizePolyline,
  validateGpsPing,
  smoothSpeedEma,
  snapToPolyline,
  computeRemainingDistanceAndEta,
  detectOffRoute,
} from "../../src/modules/tracking/tracking.algo";

describe("Tracking Algorithm Utilities", () => {
  describe("haversineDistanceMeters", () => {
    it("returns ~0 for identical coordinates", () => {
      const dist = haversineDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946);
      expect(dist).toBeCloseTo(0, 1);
    });

    it("calculates accurate distance between known Bangalore points", () => {
      // MG Road (12.9756, 77.6066) to Indiranagar (12.9784, 77.6408) is ~3.7 km
      const dist = haversineDistanceMeters(12.9756, 77.6066, 12.9784, 77.6408);
      expect(dist).toBeGreaterThan(3500);
      expect(dist).toBeLessThan(3900);
    });

    it("is symmetric", () => {
      const d1 = haversineDistanceMeters(12.9716, 77.5946, 12.9352, 77.6245);
      const d2 = haversineDistanceMeters(12.9352, 77.6245, 12.9716, 77.5946);
      expect(d1).toBeCloseTo(d2, 2);
    });
  });

  describe("calculateBearing", () => {
    it("computes ~0 / 360 degrees for true north", () => {
      const bearing = calculateBearing(12.0, 77.0, 13.0, 77.0);
      expect(bearing).toBeCloseTo(0, 1);
    });

    it("computes ~90 degrees for due east", () => {
      const bearing = calculateBearing(12.0, 77.0, 12.0, 78.0);
      expect(bearing).toBeCloseTo(90, 0);
    });

    it("computes ~180 degrees for due south", () => {
      const bearing = calculateBearing(13.0, 77.0, 12.0, 77.0);
      expect(bearing).toBeCloseTo(180, 0);
    });

    it("computes ~270 degrees for due west", () => {
      const bearing = calculateBearing(12.0, 78.0, 12.0, 77.0);
      expect(bearing).toBeCloseTo(270, 0);
    });
  });

  describe("normalizeCoordinates & normalizePolyline", () => {
    it("converts GeoJSON [lng, lat] to Leaflet [lat, lng] for Indian coordinates", () => {
      // GeoJSON: [77.5946, 12.9716]
      const normalized = normalizeCoordinates([77.5946, 12.9716]);
      expect(normalized[0]).toBeCloseTo(12.9716, 4);
      expect(normalized[1]).toBeCloseTo(77.5946, 4);
    });

    it("keeps already valid [lat, lng] untouched", () => {
      const normalized = normalizeCoordinates([12.9716, 77.5946]);
      expect(normalized[0]).toBeCloseTo(12.9716, 4);
      expect(normalized[1]).toBeCloseTo(77.5946, 4);
    });

    it("normalizes an entire polyline array", () => {
      const polyline: [number, number][] = [
        [77.59, 12.97],
        [77.60, 12.98],
      ];
      const normalized = normalizePolyline(polyline);
      expect(normalized[0]![0]).toBeCloseTo(12.97, 2);
      expect(normalized[0]![1]).toBeCloseTo(77.59, 2);
      expect(normalized[1]![0]).toBeCloseTo(12.98, 2);
      expect(normalized[1]![1]).toBeCloseTo(77.60, 2);
    });
  });

  describe("validateGpsPing", () => {
    it("drops noisy pings with accuracy > 50 meters", () => {
      const result = validateGpsPing({
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 65,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("ACCURACY_TOO_LOW");
    });

    it("accepts accurate pings", () => {
      const result = validateGpsPing({
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 15,
      });
      expect(result.valid).toBe(true);
    });

    it("drops out of order sequence pings", () => {
      const prevPing = { lat: 12.9716, lng: 77.5946, ts: 1000, seq: 10 };
      const currentPing = { lat: 12.9718, lng: 77.5948, sequence: 8 };
      const result = validateGpsPing(currentPing, prevPing, 2000);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("OUT_OF_ORDER_SEQUENCE");
    });

    it("drops impossible teleport jumps (> 90 km/h)", () => {
      const prevPing = { lat: 12.9716, lng: 77.5946, ts: 1000, seq: 1 };
      // 5km away in 2 seconds = 9000 km/h!
      const currentPing = { lat: 13.0166, lng: 77.5946, sequence: 2 };
      const result = validateGpsPing(currentPing, prevPing, 3000);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("TELEPORT_SPEED_EXCEEDED");
    });

    it("identifies stationary pings (< 1m moved)", () => {
      const prevPing = { lat: 12.9716, lng: 77.5946, ts: 1000, seq: 1 };
      // 0.2m difference
      const currentPing = { lat: 12.971601, lng: 77.594601, sequence: 2 };
      const result = validateGpsPing(currentPing, prevPing, 3000);
      expect(result.valid).toBe(true);
      expect(result.isStationary).toBe(true);
    });
  });

  describe("smoothSpeedEma", () => {
    it("returns 0 when stationary", () => {
      expect(smoothSpeedEma(25, 20, true)).toBe(0);
    });

    it("applies exponential moving average when moving", () => {
      const smoothed = smoothSpeedEma(30, 20, false, 0.3);
      // 0.3 * 30 + 0.7 * 20 = 23
      expect(smoothed).toBe(23);
    });

    it("enforces minimum floor when raw speed is missing", () => {
      const smoothed = smoothSpeedEma(null, null, false);
      expect(smoothed).toBeGreaterThanOrEqual(10);
    });
  });

  describe("snapToPolyline", () => {
    const roadPolyline: [number, number][] = [
      [12.9700, 77.5900],
      [12.9750, 77.5900], // Straight North along 77.5900
      [12.9750, 77.5950], // Then East
    ];

    it("snaps rider to road when within 60 meters", () => {
      // Rider is slightly to the east of the first segment
      const rider = { lat: 12.9725, lng: 77.5901 }; // ~10m offset
      const snap = snapToPolyline(rider, roadPolyline, 60);

      expect(snap.segmentIndex).toBe(0);
      expect(snap.snappedLng).toBeCloseTo(77.5900, 4);
      expect(snap.distanceToRoadMeters).toBeLessThan(20);
    });

    it("does not snap when distance to road exceeds threshold", () => {
      const rider = { lat: 12.9725, lng: 77.5920 }; // ~200m offset
      const snap = snapToPolyline(rider, roadPolyline, 60);

      expect(snap.segmentIndex).toBe(-1);
      expect(snap.snappedLng).toBeCloseTo(77.5920, 4);
      expect(snap.distanceToRoadMeters).toBeGreaterThan(60);
    });
  });

  describe("computeRemainingDistanceAndEta", () => {
    const roadPolyline: [number, number][] = [
      [12.9700, 77.5900],
      [12.9750, 77.5900],
      [12.9750, 77.5950],
    ];

    it("computes remaining distance and dynamic ETA in seconds", () => {
      const snapped = { lat: 12.9725, lng: 77.5900 };
      const { remainingMeters, etaSeconds } = computeRemainingDistanceAndEta(
        roadPolyline,
        snapped,
        0,
        20 // 20 km/h
      );

      expect(remainingMeters).toBeGreaterThan(500);
      expect(etaSeconds).toBeGreaterThan(50);
    });
  });

  describe("detectOffRoute", () => {
    it("does not trigger off-route on single isolated deviation", () => {
      const result = detectOffRoute(180, 0, 150);
      expect(result.isOffRoute).toBe(false);
      expect(result.newCount).toBe(1);
    });

    it("triggers off-route on 2 consecutive deviations", () => {
      const result = detectOffRoute(180, 1, 150);
      expect(result.isOffRoute).toBe(true);
      expect(result.newCount).toBe(2);
    });

    it("resets count when rider returns to polyline", () => {
      const result = detectOffRoute(40, 1, 150);
      expect(result.isOffRoute).toBe(false);
      expect(result.newCount).toBe(0);
    });
  });
});
