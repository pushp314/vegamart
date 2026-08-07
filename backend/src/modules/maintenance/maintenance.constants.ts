import type { MaintenanceModuleConfig } from "./maintenance.types";

export const MAINTENANCE_MODULE_SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

export const MAINTENANCE_DEFAULT_MESSAGE =
  "This site is currently undergoing scheduled maintenance. We will be back shortly.";

export const MAINTENANCE_AUDIT_ACTIONS = {
  ENABLED: "enabled",
  DISABLED: "disabled",
} as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function maintenanceModuleConfig(): MaintenanceModuleConfig {
  return {
    rateLimitWindowMs: parsePositiveInt(process.env.MAINTENANCE_RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: parsePositiveInt(process.env.MAINTENANCE_RATE_LIMIT_MAX, 20),
    cacheTtlMs: parsePositiveInt(process.env.MAINTENANCE_CACHE_TTL_MS, 10_000),
    defaultMessage:
      process.env.MAINTENANCE_DEFAULT_MESSAGE ?? MAINTENANCE_DEFAULT_MESSAGE,
  };
}
