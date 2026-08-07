import type { Request } from "express";

import log from "../../config/logger";
import {
  MAINTENANCE_AUDIT_ACTIONS,
  maintenanceModuleConfig,
} from "./maintenance.constants";
import type { MaintenanceAuditAction } from "./maintenance.types";
import { maintenanceRepository } from "./maintenance.repository";
import type { MaintenanceStateDto, PublicMaintenanceStatus } from "./maintenance.types";

const config = maintenanceModuleConfig();

interface StateCache {
  enabled: boolean;
  message: string | null;
  expiresAt: number;
}

let stateCache: StateCache | null = null;

function clearStateCache(): void {
  stateCache = null;
}

async function readState() {
  try {
    return await maintenanceRepository.getState();
  } catch (error) {
    log.error("[maintenance] Failed to read maintenance state", {
      context: "maintenance",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readCachedState(): Promise<{ enabled: boolean; message: string | null }> {
  if (stateCache && Date.now() < stateCache.expiresAt) {
    return { enabled: stateCache.enabled, message: stateCache.message };
  }
  const row = await readState();
  const result = {
    enabled: row?.maintenanceEnabled ?? false,
    message: row?.maintenanceMessage ?? null,
  };
  stateCache = {
    enabled: result.enabled,
    message: result.message,
    expiresAt: Date.now() + config.cacheTtlMs,
  };
  return result;
}

function extractIp(req?: Request): string {
  if (!req) return "";
  return req.ip ?? (req.headers["x-forwarded-for"] as string) ?? "";
}

function extractUserAgent(req?: Request): string {
  return req ? (req.headers["user-agent"] as string) ?? "" : "";
}

export const maintenanceService = {
  async isMaintenanceEnabled(): Promise<boolean> {
    return (await readCachedState()).enabled;
  },

  async getPublicStatus(): Promise<PublicMaintenanceStatus> {
    const { enabled, message } = await readCachedState();
    return { maintenance: enabled, message: message ?? config.defaultMessage };
  },

  async enable(input: {
    message?: string;
    updatedBy: string;
    audit?: { ip?: string; userAgent?: string };
  }): Promise<MaintenanceStateDto> {
    const message = input.message?.trim() || config.defaultMessage;
    const row = await maintenanceRepository.upsertState({
      maintenanceEnabled: true,
      maintenanceMessage: message,
      updatedBy: input.updatedBy,
    });
    clearStateCache();
    await this.logAudit(MAINTENANCE_AUDIT_ACTIONS.ENABLED, input.updatedBy, input.audit, message);
    return {
      maintenanceEnabled: row.maintenanceEnabled,
      maintenanceMessage: row.maintenanceMessage,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async disable(input: {
    updatedBy: string;
    audit?: { ip?: string; userAgent?: string };
  }): Promise<{ maintenanceEnabled: boolean }> {
    const row = await maintenanceRepository.upsertState({
      maintenanceEnabled: false,
      maintenanceMessage: null,
      updatedBy: input.updatedBy,
    });
    clearStateCache();
    await this.logAudit(MAINTENANCE_AUDIT_ACTIONS.DISABLED, input.updatedBy, input.audit, null);
    return { maintenanceEnabled: row.maintenanceEnabled };
  },

  async logAudit(
    action: MaintenanceAuditAction,
    developerId: string,
    audit?: { ip?: string; userAgent?: string },
    message?: string | null
  ): Promise<void> {
    try {
      await maintenanceRepository.createAuditLog({
        action,
        developerId,
        ipAddress: audit?.ip ?? "",
        userAgent: audit?.userAgent ?? "",
        message: message ?? null,
      });
    } catch (error) {
      log.error(`[maintenance] Failed to persist audit log for action "${action}"`, {
        context: "maintenance",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  extractAuditContext(req?: Request): { ip: string; userAgent: string } {
    return {
      ip: extractIp(req),
      userAgent: extractUserAgent(req),
    };
  },
};
