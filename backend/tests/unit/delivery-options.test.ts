import { normalizeDeliveryConfigs } from "../../src/services/vendor.service";
import { createVendorSchema, updateVendorSchema } from "../../src/validators/vendor.validators";

describe("4 Delivery Options System", () => {
  describe("normalizeDeliveryConfigs", () => {
    it("returns sensible defaults when raw configs are empty", () => {
      const result = normalizeDeliveryConfigs({}, {
        provides_delivery: true,
        delivery_fee: 45 as any,
        advance_payment_percentage: 15 as any,
        min_order: 100 as any,
      });

      expect(result.booking).toEqual({
        enabled: false,
        advance_percentage: 15,
        min_order: 100,
      });
      expect(result.self_pickup).toEqual({
        enabled: true,
        advance_percentage: 15,
        min_order: 100,
      });
      expect(result.shop_delivery).toEqual({
        enabled: true,
        delivery_fee: 45,
        min_order: 100,
      });
      expect(result.delivery_partner).toEqual({
        enabled: true,
        delivery_fee: undefined,
        min_order: undefined,
      });
    });

    it("respects vendor custom delivery configs", () => {
      const customConfigs = {
        booking: { enabled: true, advance_percentage: 50, min_order: 500 },
        self_pickup: { enabled: false, advance_percentage: 0, min_order: 0 },
        shop_delivery: { enabled: true, delivery_fee: 60, min_order: 250 },
        delivery_partner: { enabled: false },
      };

      const result = normalizeDeliveryConfigs(customConfigs);

      expect(result.booking.enabled).toBe(true);
      expect(result.booking.advance_percentage).toBe(50);
      expect(result.booking.min_order).toBe(500);

      expect(result.self_pickup.enabled).toBe(false);
      expect(result.self_pickup.advance_percentage).toBe(0);

      expect(result.shop_delivery.enabled).toBe(true);
      expect(result.shop_delivery.delivery_fee).toBe(60);
      expect(result.shop_delivery.min_order).toBe(250);

      expect(result.delivery_partner.enabled).toBe(false);
    });

    it("safely handles Decimal objects with toNumber method", () => {
      const decMock = (v: number) => ({ toNumber: () => v });
      const result = normalizeDeliveryConfigs(undefined, {
        provides_delivery: false,
        delivery_fee: decMock(35) as any,
        advance_payment_percentage: decMock(20) as any,
        min_order: decMock(150) as any,
      });

      expect(result.booking.advance_percentage).toBe(20);
      expect(result.booking.min_order).toBe(150);
      expect(result.self_pickup.advance_percentage).toBe(20);
      expect(result.shop_delivery.delivery_fee).toBe(35);
    });
  });

  describe("Vendor Validators for delivery_configs", () => {
    it("accepts valid delivery_configs in create vendor schema", () => {
      const payload = {
        business_name: "Fresh Fruits Direct",
        address: "Market Road, Block 4",
        city: "Jaipur",
        state: "Rajasthan",
        pincode: "302001",
        delivery_configs: {
          booking: { enabled: true, advance_percentage: 25, min_order: 200 },
          self_pickup: { enabled: true, advance_percentage: 10, min_order: 0 },
          shop_delivery: { enabled: true, delivery_fee: 30, min_order: 150 },
          delivery_partner: { enabled: false },
        },
      };

      const parsed = createVendorSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.delivery_configs?.booking?.enabled).toBe(true);
        expect(parsed.data.delivery_configs?.booking?.advance_percentage).toBe(25);
        expect(parsed.data.delivery_configs?.shop_delivery?.delivery_fee).toBe(30);
      }
    });

    it("accepts partial delivery_configs in update vendor schema", () => {
      const payload = {
        delivery_configs: {
          estimated_delivery_time: "15-20 mins",
          booking: { enabled: false, estimated_time: "2 days" },
          shop_delivery: { enabled: true, delivery_fee: 50, estimated_time: "30 mins" },
        },
        estimated_delivery_time: "15-20 mins",
      };

      const parsed = updateVendorSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.estimated_delivery_time).toBe("15-20 mins");
        expect(parsed.data.delivery_configs?.estimated_delivery_time).toBe("15-20 mins");
        expect(parsed.data.delivery_configs?.booking?.estimated_time).toBe("2 days");
        expect(parsed.data.delivery_configs?.shop_delivery?.estimated_time).toBe("30 mins");
      }
    });

    it("normalizes delivery configs preserving custom estimated times", () => {
      const customConfigs = {
        estimated_delivery_time: "25-35 mins",
        booking: { enabled: true, advance_percentage: 20, min_order: 100, estimated_time: "1-2 days" },
        self_pickup: { enabled: true, advance_percentage: 10, min_order: 0, estimated_time: "10 mins" },
        shop_delivery: { enabled: true, delivery_fee: 40, min_order: 200, estimated_time: "20-30 mins" },
      };

      const result = normalizeDeliveryConfigs(customConfigs);
      expect(result.estimated_delivery_time).toBe("25-35 mins");
      expect(result.booking.estimated_time).toBe("1-2 days");
      expect(result.self_pickup.estimated_time).toBe("10 mins");
      expect(result.shop_delivery.estimated_time).toBe("20-30 mins");
    });
  });
});
