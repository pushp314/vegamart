import { createCouponSchema, updateCouponSchema } from "../../src/validators/coupon.validators";

describe("coupon validators", () => {
  describe("createCouponSchema", () => {
    it("successfully validates and defaults FREE_DELIVERY coupon with no value specified", () => {
      const parsed = createCouponSchema.parse({
        code: "freedelivery",
        type: "FREE_DELIVERY",
      });

      expect(parsed.code).toBe("FREEDELIVERY");
      expect(parsed.type).toBe("FREE_DELIVERY");
      expect(parsed.value).toBe(0);
      expect(parsed.is_active).toBe(true);
      expect(parsed.usage_limit).toBe(0);
      expect(parsed.per_user_limit).toBe(1);
      expect(parsed.valid_from).toBeInstanceOf(Date);
      expect(parsed.valid_until).toBeInstanceOf(Date);
      expect(parsed.valid_until > parsed.valid_from).toBe(true);
    });

    it("preprocesses empty string min_order_value and max_discount to null", () => {
      const parsed = createCouponSchema.parse({
        code: "SAVE20",
        type: "PERCENTAGE",
        value: "20",
        min_order_value: "",
        max_discount: "",
      });

      expect(parsed.min_order_value).toBeNull();
      expect(parsed.max_discount).toBeNull();
      expect(parsed.value).toBe(20);
    });

    it("rejects percentage coupon with value <= 0 or > 100", () => {
      expect(() =>
        createCouponSchema.parse({
          code: "INVALID0",
          type: "PERCENTAGE",
          value: 0,
        })
      ).toThrow("Percentage discount must be greater than 0%.");

      expect(() =>
        createCouponSchema.parse({
          code: "INVALID150",
          type: "PERCENTAGE",
          value: 150,
        })
      ).toThrow("Percentage discount cannot exceed 100%.");
    });

    it("rejects fixed discount coupon with value <= 0", () => {
      expect(() =>
        createCouponSchema.parse({
          code: "INVALIDFIXED",
          type: "FIXED",
          value: 0,
        })
      ).toThrow("Fixed discount amount must be greater than ₹0.");
    });

    it("rejects when expiry date is before start date", () => {
      expect(() =>
        createCouponSchema.parse({
          code: "EXPIRED",
          type: "FIXED",
          value: 50,
          valid_from: new Date("2026-12-01"),
          valid_until: new Date("2026-11-01"),
        })
      ).toThrow("Expiry date (valid_until) must be after start date (valid_from).");
    });
  });

  describe("updateCouponSchema", () => {
    it("transforms code to uppercase and preprocesses empty strings", () => {
      const parsed = updateCouponSchema.parse({
        code: "updatedcode",
        min_order_value: "",
        max_discount: "",
      });

      expect(parsed.code).toBe("UPDATEDCODE");
      expect(parsed.min_order_value).toBeNull();
      expect(parsed.max_discount).toBeNull();
    });
  });
});
