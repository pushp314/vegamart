import type { MaintenanceModuleConfig } from "./maintenance.types";

export const MAINTENANCE_MODULE_SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

export const MAINTENANCE_DEVELOPER_ROLE = "DEVELOPER";
export const MAINTENANCE_TOKEN_SCOPE = "maintenance";
export const MAINTENANCE_JWT_ISSUER = "vegamart-maintenance";
export const MAINTENANCE_JWT_AUDIENCE = "vegamart-maintenance-client";
export const MAINTENANCE_API_KEY_HEADER = "x-api-key";

export const MAINTENANCE_DEFAULT_MESSAGE =
  "This site is currently undergoing scheduled maintenance. We will be back shortly.";

export const MAINTENANCE_AUDIT_ACTIONS = {
  ENABLED: "enabled",
  DISABLED: "disabled",
  UPDATED: "updated",
  TOKEN_ISSUED: "token_issued",
  AUTH_FAILED: "auth_failed",
  RATE_LIMITED: "rate_limited",
} as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function maintenanceModuleConfig(): MaintenanceModuleConfig {
  return {
    devApiKey: process.env.MAINTENANCE_DEV_API_KEY ?? "",
    devJwtSecret: process.env.MAINTENANCE_DEV_JWT_SECRET ?? "",
    devJwtTtlSeconds: parsePositiveInt(process.env.MAINTENANCE_DEV_JWT_TTL_SECONDS, 900),
    devJwtIssuer: process.env.MAINTENANCE_DEV_JWT_ISSUER ?? MAINTENANCE_JWT_ISSUER,
    devJwtAudience: process.env.MAINTENANCE_DEV_JWT_AUDIENCE ?? MAINTENANCE_JWT_AUDIENCE,
    devAllowedIps: (process.env.MAINTENANCE_DEV_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitWindowMs: parsePositiveInt(process.env.MAINTENANCE_DEV_RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: parsePositiveInt(process.env.MAINTENANCE_DEV_RATE_LIMIT_MAX, 20),
    cacheTtlMs: parsePositiveInt(process.env.MAINTENANCE_CACHE_TTL_MS, 10_000),
    defaultMessage:
      process.env.MAINTENANCE_DEFAULT_MESSAGE ?? MAINTENANCE_DEFAULT_MESSAGE,
  };
}
