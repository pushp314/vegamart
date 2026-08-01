import { slugify, uniqueSlug } from "../../src/utils/slug";

describe("slug util", () => {
  describe("slugify", () => {
    it("lowercases and replaces spaces", () => {
      expect(slugify("Fresh Vegetables")).toBe("fresh-vegetables");
    });

    it("strips punctuation", () => {
      expect(slugify("Bhai's Fruit & Veg!" )).toBe("bhais-fruit-veg");
    });

    it("collapses and trims hyphens", () => {
      expect(slugify("  --  Mango  --  ")).toBe("mango");
    });

    it("strips non-latin characters", () => {
      expect(slugify("फल")).toBe("");
    });
  });

  describe("uniqueSlug", () => {
    it("returns the base slug when free", () => {
      expect(uniqueSlug("Fresh Mango", new Set(["tomato"]))).toBe("fresh-mango");
    });

    it("appends -2, -3 for collisions", () => {
      const existing = new Set(["apple", "apple-2"]);
      expect(uniqueSlug("Apple", existing)).toBe("apple-3");
    });

    it("falls back to a safe root for empty input", () => {
      expect(uniqueSlug("   ", new Set())).toBe("item");
    });
  });
});
