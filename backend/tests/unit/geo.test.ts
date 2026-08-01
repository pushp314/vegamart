import { boundingBox, haversineDistanceKm } from "../../src/utils/geo";

describe("geo utils", () => {
  describe("haversineDistanceKm", () => {
    it("returns ~0 for identical coordinates", () => {
      expect(haversineDistanceKm(28.6139, 77.209, 28.6139, 77.209)).toBeCloseTo(0, 5);
    });

    it("matches the known Delhi-Agra distance (~178 km)", () => {
      const dist = haversineDistanceKm(28.6139, 77.209, 27.1767, 78.0081);
      expect(dist).toBeGreaterThan(170);
      expect(dist).toBeLessThan(185);
    });

    it("is symmetric", () => {
      const a = haversineDistanceKm(28.61, 77.2, 12.97, 77.59);
      const b = haversineDistanceKm(12.97, 77.59, 28.61, 77.2);
      expect(a).toBeCloseTo(b, 5);
    });
  });

  describe("boundingBox", () => {
    it("centers the box on the given point", () => {
      const box = boundingBox(28.6139, 77.209, 5);
      expect(box.minLat).toBeLessThan(28.6139);
      expect(box.maxLat).toBeGreaterThan(28.6139);
      expect(box.minLng).toBeLessThan(77.209);
      expect(box.maxLng).toBeGreaterThan(77.209);
    });

    it("grows with radius", () => {
      const small = boundingBox(28.61, 77.2, 2);
      const large = boundingBox(28.61, 77.2, 10);
      expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
    });
  });
});
