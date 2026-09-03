export const SETTING_KEYS = {
  PLATFORM_NAME: "platform.name",
  PLATFORM_CURRENCY: "platform.currency",
  TAX_RATE_PERCENT: "platform.tax_rate_percent",
  DELIVERY_FEE: "platform.delivery_fee",
  FREE_DELIVERY_THRESHOLD: "platform.free_delivery_threshold",
  MIN_ORDER_VALUE: "platform.min_order_value",
  ORDER_EXPIRY_MINUTES: "platform.order_expiry_minutes",
  MAX_ORDER_QUANTITY: "platform.max_order_quantity",
  MAX_CART_ITEMS: "platform.max_cart_items",
  MAINTENANCE_MODE: "platform.maintenance_mode",
  PLATFORM_LOGO_URL: "platform.logo_url",
  ANNOUNCEMENT_ENABLED: "notifications.announcement_enabled",
  SUPPORT_EMAIL: "support.email",
  SUPPORT_PHONE: "support.phone",
  MULTI_STORE_CHECKOUT_ENABLED: "platform.multi_store_checkout_enabled",
  DELIVERIES_ACTIVE: "platform.deliveries_active",
  DEFAULT_DELIVERY_RADIUS_KM: "platform.default_delivery_radius_km",
  HOMEPAGE_SECTIONS: "platform.homepage_sections",
  DEFAULT_DELIVERY_ETA: "platform.default_delivery_eta",
  VEGAMART_DELIVERY_ENABLED: "platform.vegamart_delivery_enabled",
  VENDOR_WALLET_ENABLED: "platform.vendor_wallet_enabled",
  VENDOR_PAYOUT_MODE: "platform.vendor_payout_mode",
  VENDOR_MIN_WITHDRAWAL_AMOUNT: "platform.vendor_min_withdrawal_amount",
  PLATFORM_CHECKOUT_CHARGES: "platform.checkout_charges",
} as const;

export type SettingValue =
  | string
  | number
  | boolean
  | null;

export interface SettingDefinition {
  key: string;
  type: "string" | "number" | "boolean";
  default: SettingValue;
  description: string;
  is_public: boolean;
}

export const DEFAULT_HOMEPAGE_SECTIONS = [
  { id: "hero", label: "Hero Banner & Promotions", description: "Top carousel banners and video spotlight", enabled: true },
  { id: "categories", label: "Categories Grid", description: "Fresh produce and department shortcuts", enabled: true },
  { id: "sponsored_vendors", label: "Sponsored Vendors & Premium Stores", description: "Featured local merchants with badges", enabled: true },
  { id: "live_banner", label: "Live Network Alert Banner", description: "Real-time moving street vendor count banner", enabled: true },
  { id: "live_vendors", label: "Nearby Live Street Vendors", description: "Live moving carts with GPS distance and speed", enabled: true },
  { id: "shops_near_you", label: "Fixed Shops & Kirana Stores", description: "Nearby trusted brick-and-mortar grocery shops", enabled: true },
  { id: "offers", label: "Discounts & Bank Offers", description: "Active promo coupons, wallet offers and discounts", enabled: true },
  { id: "shopwise_products", label: "Shop-wise Fresh Produce", description: "Curated product shelves organized by merchant", enabled: true },
  { id: "trending", label: "Trending & Best Sellers", description: "High-demand fresh products ordered nearby", enabled: true },
  { id: "featured_products", label: "Featured Deals & Essentials", description: "Daily essentials and handpicked product deals", enabled: true },
  { id: "recommended", label: "Recommended For You", description: "Smart product recommendations based on preferences", enabled: true },
  { id: "recently_viewed", label: "Recently Viewed Items", description: "Quick access to products the customer viewed", enabled: true },
  { id: "brand_footer", label: "Why VegaMart & Trust Badges", description: "Safety guarantees, quality promise, and brand footer", enabled: true },
];

export const DEFAULT_SETTINGS: Record<string, SettingDefinition> = {
  [SETTING_KEYS.PLATFORM_NAME]: {
    key: SETTING_KEYS.PLATFORM_NAME,
    type: "string",
    default: "VegaMart",
    description: "Display name of the platform.",
    is_public: true,
  },
  [SETTING_KEYS.PLATFORM_CURRENCY]: {
    key: SETTING_KEYS.PLATFORM_CURRENCY,
    type: "string",
    default: "INR",
    description: "Default currency code used across the platform.",
    is_public: true,
  },
  [SETTING_KEYS.TAX_RATE_PERCENT]: {
    key: SETTING_KEYS.TAX_RATE_PERCENT,
    type: "number",
    default: 5,
    description: "Tax rate (GST) applied to order subtotals, in percent.",
    is_public: true,
  },
  [SETTING_KEYS.DELIVERY_FEE]: {
    key: SETTING_KEYS.DELIVERY_FEE,
    type: "number",
    default: 30,
    description: "Flat delivery fee charged per order.",
    is_public: true,
  },
  [SETTING_KEYS.FREE_DELIVERY_THRESHOLD]: {
    key: SETTING_KEYS.FREE_DELIVERY_THRESHOLD,
    type: "number",
    default: 299,
    description: "Order value above which delivery is free.",
    is_public: true,
  },
  [SETTING_KEYS.MIN_ORDER_VALUE]: {
    key: SETTING_KEYS.MIN_ORDER_VALUE,
    type: "number",
    default: 0,
    description: "Minimum order subtotal required to place an order.",
    is_public: true,
  },
  [SETTING_KEYS.ORDER_EXPIRY_MINUTES]: {
    key: SETTING_KEYS.ORDER_EXPIRY_MINUTES,
    type: "number",
    default: 15,
    description: "Minutes a pending COD order stays valid before expiry.",
    is_public: false,
  },
  [SETTING_KEYS.MAX_ORDER_QUANTITY]: {
    key: SETTING_KEYS.MAX_ORDER_QUANTITY,
    type: "number",
    default: 20,
    description: "Maximum quantity of a single item allowed per order.",
    is_public: false,
  },
  [SETTING_KEYS.MAX_CART_ITEMS]: {
    key: SETTING_KEYS.MAX_CART_ITEMS,
    type: "number",
    default: 50,
    description: "Maximum distinct items allowed in a cart.",
    is_public: false,
  },
  [SETTING_KEYS.MAINTENANCE_MODE]: {
    key: SETTING_KEYS.MAINTENANCE_MODE,
    type: "boolean",
    default: false,
    description: "When enabled, the app shows a maintenance notice.",
    is_public: true,
  },
  [SETTING_KEYS.PLATFORM_LOGO_URL]: {
    key: SETTING_KEYS.PLATFORM_LOGO_URL,
    type: "string",
    default: "/icons/icon-512.png",
    description: "URL of the platform logo image.",
    is_public: true,
  },
  [SETTING_KEYS.ANNOUNCEMENT_ENABLED]: {
    key: SETTING_KEYS.ANNOUNCEMENT_ENABLED,
    type: "boolean",
    default: true,
    description: "Enables in-app announcements.",
    is_public: false,
  },
  [SETTING_KEYS.SUPPORT_EMAIL]: {
    key: SETTING_KEYS.SUPPORT_EMAIL,
    type: "string",
    default: "support@vegamart.in",
    description: "Public support email address.",
    is_public: true,
  },
  [SETTING_KEYS.SUPPORT_PHONE]: {
    key: SETTING_KEYS.SUPPORT_PHONE,
    type: "string",
    default: "+91 00000 00000",
    description: "Public support phone number.",
    is_public: true,
  },
  [SETTING_KEYS.MULTI_STORE_CHECKOUT_ENABLED]: {
    key: SETTING_KEYS.MULTI_STORE_CHECKOUT_ENABLED,
    type: "boolean",
    default: false,
    description: "Allow customers to add products from multiple stores to a single cart.",
    is_public: true,
  },
  [SETTING_KEYS.DELIVERIES_ACTIVE]: {
    key: SETTING_KEYS.DELIVERIES_ACTIVE,
    type: "boolean",
    default: true,
    description: "Whether the platform is accepting delivery orders.",
    is_public: true,
  },
  [SETTING_KEYS.DEFAULT_DELIVERY_RADIUS_KM]: {
    key: SETTING_KEYS.DEFAULT_DELIVERY_RADIUS_KM,
    type: "number",
    default: 10,
    description: "Default maximum delivery radius in kilometres.",
    is_public: true,
  },
  [SETTING_KEYS.HOMEPAGE_SECTIONS]: {
    key: SETTING_KEYS.HOMEPAGE_SECTIONS,
    type: "string",
    default: JSON.stringify(DEFAULT_HOMEPAGE_SECTIONS),
    description: "Ordered JSON array of home page sections and their visibility.",
    is_public: true,
  },
  [SETTING_KEYS.DEFAULT_DELIVERY_ETA]: {
    key: SETTING_KEYS.DEFAULT_DELIVERY_ETA,
    type: "string",
    default: "20-30 mins",
    description: "Default estimated delivery time for VegaMart Delivery Partner rider orders.",
    is_public: true,
  },
  [SETTING_KEYS.VEGAMART_DELIVERY_ENABLED]: {
    key: SETTING_KEYS.VEGAMART_DELIVERY_ENABLED,
    type: "boolean",
    default: true,
    description: "Master switch to enable or disable VegaMart Delivery Partner fleet platform-wide.",
    is_public: true,
  },
  [SETTING_KEYS.VENDOR_WALLET_ENABLED]: {
    key: SETTING_KEYS.VENDOR_WALLET_ENABLED,
    type: "boolean",
    default: true,
    description: "Master switch to enable or disable Vendor Wallet & automated direct bank payouts.",
    is_public: true,
  },
  [SETTING_KEYS.VENDOR_PAYOUT_MODE]: {
    key: SETTING_KEYS.VENDOR_PAYOUT_MODE,
    type: "string",
    default: "razorpay_route",
    description: "Vendor settlement and payout mode: razorpay_route | razorpay_payouts | manual.",
    is_public: true,
  },
  [SETTING_KEYS.VENDOR_MIN_WITHDRAWAL_AMOUNT]: {
    key: SETTING_KEYS.VENDOR_MIN_WITHDRAWAL_AMOUNT,
    type: "number",
    default: 100,
    description: "Minimum balance threshold in INR required for vendor withdrawal or settlement.",
    is_public: true,
  },
  [SETTING_KEYS.PLATFORM_CHECKOUT_CHARGES]: {
    key: SETTING_KEYS.PLATFORM_CHECKOUT_CHARGES,
    type: "string",
    default: JSON.stringify([]),
    description: "Configurable extra checkout charges (e.g., Rain charge, Platform fee). Format: JSON Array.",
    is_public: true,
  },
};

export const ADMIN_SETTING_KEYS = Object.values(SETTING_KEYS);
