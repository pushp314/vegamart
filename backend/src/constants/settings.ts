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
};

export const ADMIN_SETTING_KEYS = Object.values(SETTING_KEYS);
