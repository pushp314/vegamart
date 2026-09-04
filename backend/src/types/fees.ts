export interface FeeConfig {
  key: string;
  name: string;
  enabled: boolean;
  type: 'FIXED' | 'PERCENTAGE';
  amount: number;
  min_order_amount: number;
  max_cap: number;
  conditions: Record<string, any>;
}

export const DEFAULT_FEES: FeeConfig[] = [
  { key: "VEGAMART_SERVICE_CHARGE", name: "VegaMart Service Charge", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "PLATFORM_FEE", name: "Platform Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "HANDLING_PACKAGING_FEE", name: "Handling / Packaging Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "EXPRESS_DELIVERY_FEE", name: "Express Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "SELF_PICKUP_FEE", name: "Self Pickup Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "ADVANCE_BOOKING_FEE", name: "Advance Booking Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "PAYMENT_PROCESSING_FEE", name: "Payment Processing Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "MULTI_STORE_PURCHASE_FEE", name: "Multi-Store Purchase Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "COD_FEE", name: "Cash on Delivery (COD) Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "BAD_WEATHER_FEE", name: "Bad Weather / Rain Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "PEAK_HOUR_FEE", name: "Peak Hour / High Demand Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "LATE_NIGHT_DELIVERY_FEE", name: "Late Night Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "SMALL_ORDER_FEE", name: "Small Order Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "DISTANCE_DELIVERY_FEE", name: "Distance Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "EXTRA_DISTANCE_FEE", name: "Extra Distance Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "URGENT_PRIORITY_FEE", name: "Urgent / Priority Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "HEAVY_BULKY_ITEM_FEE", name: "Heavy / Bulky Item Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "FRAGILE_ITEM_FEE", name: "Fragile Item Handling Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "SPECIAL_PACKAGING_FEE", name: "Special Packaging Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "FROZEN_DELIVERY_FEE", name: "Temperature-Controlled Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "SCHEDULED_DELIVERY_FEE", name: "Scheduled Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "ORDER_SPLITTING_FEE", name: "Order Splitting Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "RE_DELIVERY_FEE", name: "Re-Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "CANCELLATION_FEE", name: "Cancellation Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "CONVENIENCE_FEE", name: "Convenience Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "FESTIVAL_SPECIAL_DAY_FEE", name: "Festival / Special Day Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
  { key: "HOLIDAY_DELIVERY_FEE", name: "Holiday Delivery Fee", enabled: false, type: "FIXED", amount: 0, min_order_amount: 0, max_cap: 0, conditions: {} },
];
