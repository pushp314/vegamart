import type { Request } from "express";

export interface SystemSettingRow {
  id: string;
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
  updatedBy: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export type PublicMaintenanceStatus = {
  maintenance: boolean;
  message: string | null;
};

export type DeveloperIdentity = {
  developerId: string;
  method: "api_key" | "jwt";
  ip: string;
};

export type DeveloperTokenPayload = {
  sub: string;
  role: string;
  scope: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
};

export interface MaintenanceGateOptions {
  excludedPaths?: string[];
  excludedPathPrefixes?: string[];
  exclude?: (req: Request) => boolean;
  cacheTtlMs?: number;
}

export type MaintenanceAuditAction =
  | "enabled"
  | "disabled"
  | "updated"
  | "token_issued"
  | "auth_failed"
  | "rate_limited";

export interface MaintenanceAuditEntry {
  action: MaintenanceAuditAction;
  developerId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  message?: string | null;
}

export interface MaintenanceModuleConfig {
  devApiKey: string;
  devJwtSecret: string;
  devJwtTtlSeconds: number;
  devJwtIssuer: string;
  devJwtAudience: string;
  devAllowedIps: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  cacheTtlMs: number;
  defaultMessage: string;
}
