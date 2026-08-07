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

export type MaintenanceStateDto = {
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export interface MaintenanceGateOptions {
  excludedPaths?: string[];
  excludedPathPrefixes?: string[];
  exclude?: (req: Request) => boolean;
  cacheTtlMs?: number;
}

export type MaintenanceAuditAction = "enabled" | "disabled";

export interface MaintenanceAuditEntry {
  action: MaintenanceAuditAction;
  developerId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  message?: string | null;
}

export interface MaintenanceModuleConfig {
  rateLimitWindowMs: number;
  rateLimitMax: number;
  cacheTtlMs: number;
  defaultMessage: string;
}
