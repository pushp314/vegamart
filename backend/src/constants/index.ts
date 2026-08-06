export const APP_NAME = "VegaMart";

export const API_PREFIX = "/api/v1";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const GUEST_USER_ID = "00000000-0000-0000-0000-000000000001";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_CURSOR_SIZE = 50;

export const ORDER_NUMBER_PREFIX = "VM";

export const TAX_RATE_PERCENT = 5;
export const DEFAULT_CURRENCY = "INR";
export const ORDER_EXPIRY_MINUTES = 15;

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt limit

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGE_DIMENSION = 8192;

export const CACHE_TTL_SECONDS = {
  PUBLIC_CATALOG: 60 * 5,
  PRODUCT_DETAIL: 60 * 5,
  NEARBY: 60,
  VENDOR_DASHBOARD: 60 * 2,
} as const;
