import type { Request } from "express";
import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";

import log from "../../config/logger";
import { UnauthorizedError, ForbiddenError } from "../../utils/ApiError";
import { safeEqual } from "../../utils/crypto";
import {
  MAINTENANCE_AUDIT_ACTIONS,
  MAINTENANCE_DEVELOPER_ROLE,
  MAINTENANCE_TOKEN_SCOPE,
  maintenanceModuleConfig,
} from "./maintenance.constants";
import type { MaintenanceAuditLogDto, MaintenanceStatusDto } from "./maintenance.dto";
import { maintenanceRepository } from "./maintenance.repository";
import type {
  DeveloperIdentity,
  DeveloperTokenPayload,
  MaintenanceAuditAction,
  PublicMaintenanceStatus,
  SystemSettingRow,
} from "./maintenance.types";

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

async function readState(): Promise<SystemSettingRow | null> {
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

export function developerIdFromIdentity(identity: DeveloperIdentity): string {
  return `${identity.method}:${identity.developerId}`;
}

export const maintenanceService = {
  async isMaintenanceEnabled(): Promise<boolean> {
    return (await readCachedState()).enabled;
  },

  async getPublicStatus(): Promise<PublicMaintenanceStatus> {
    const { enabled, message } = await readCachedState();
    return { maintenance: enabled, message: message ?? config.defaultMessage };
  },

  async getFullState(): Promise<MaintenanceStatusDto | null> {
    const row = await maintenanceRepository.getState();
    if (!row) return null;
    return {
      maintenanceEnabled: row.maintenanceEnabled,
      maintenanceMessage: row.maintenanceMessage,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  },

  async enable(input: {
    message?: string;
    updatedBy: string;
    audit?: { ip?: string; userAgent?: string };
  }): Promise<MaintenanceStatusDto> {
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

  async updateMessage(input: {
    message: string;
    updatedBy: string;
    audit?: { ip?: string; userAgent?: string };
  }): Promise<MaintenanceStatusDto> {
    const message = input.message.trim();
    const row = await maintenanceRepository.upsertState({
      maintenanceEnabled: true,
      maintenanceMessage: message,
      updatedBy: input.updatedBy,
    });
    clearStateCache();
    await this.logAudit(MAINTENANCE_AUDIT_ACTIONS.UPDATED, input.updatedBy, input.audit, message);
    return {
      maintenanceEnabled: row.maintenanceEnabled,
      maintenanceMessage: row.maintenanceMessage,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async getAuditLogs(limit = 50): Promise<MaintenanceAuditLogDto[]> {
    const rows = await maintenanceRepository.listAuditLogs(limit);
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      developerId: row.developerId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    }));
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

  isDeveloperIpAllowed(ip: string): boolean {
    if (config.devAllowedIps.length === 0) return true;
    return config.devAllowedIps.includes(ip);
  },

  validateDeveloperApiKey(apiKey: string): void {
    if (!config.devApiKey) {
      log.error("[maintenance] MAINTENANCE_DEV_API_KEY is not configured", {
        context: "maintenance",
      });
      throw new ForbiddenError("Developer API key is not configured on this server.");
    }
    if (!safeEqual(apiKey, config.devApiKey)) {
      throw new UnauthorizedError("Invalid developer API key.");
    }
  },

  issueDeveloperToken(apiKey: string, identity: DeveloperIdentity): { token: string; expiresInSeconds: number } {
    if (!config.devApiKey) {
      log.error("[maintenance] MAINTENANCE_DEV_API_KEY is not configured", {
        context: "maintenance",
      });
      throw new ForbiddenError("Developer API key is not configured on this server.");
    }
    if (!safeEqual(apiKey, config.devApiKey)) {
      throw new UnauthorizedError("Invalid developer API key.");
    }
    if (!config.devJwtSecret) {
      log.error("[maintenance] MAINTENANCE_DEV_JWT_SECRET is not configured", {
        context: "maintenance",
      });
      throw new ForbiddenError("Developer JWT secret is not configured on this server.");
    }

    const payload: DeveloperTokenPayload = {
      sub: identity.developerId,
      role: MAINTENANCE_DEVELOPER_ROLE,
      scope: MAINTENANCE_TOKEN_SCOPE,
    };
    const options: SignOptions = {
      expiresIn: config.devJwtTtlSeconds,
      issuer: config.devJwtIssuer,
      audience: config.devJwtAudience,
    };
    return {
      token: jwt.sign(payload, config.devJwtSecret, options),
      expiresInSeconds: config.devJwtTtlSeconds,
    };
  },

  verifyDeveloperToken(token: string, ip: string): DeveloperIdentity {
    if (!config.devJwtSecret) {
      log.error("[maintenance] MAINTENANCE_DEV_JWT_SECRET is not configured", {
        context: "maintenance",
      });
      throw new ForbiddenError("Developer JWT secret is not configured on this server.");
    }

    const options: VerifyOptions = {
      issuer: config.devJwtIssuer,
      audience: config.devJwtAudience,
    };

    let payload: DeveloperTokenPayload;
    try {
      payload = jwt.verify(token, config.devJwtSecret, options) as DeveloperTokenPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired developer token.");
    }

    if (payload.role !== MAINTENANCE_DEVELOPER_ROLE || payload.scope !== MAINTENANCE_TOKEN_SCOPE) {
      throw new UnauthorizedError("Developer token is not authorized for maintenance control.");
    }

    return {
      developerId: payload.sub ?? "developer",
      method: "jwt",
      ip,
    };
  },

  extractIdentityFromRequest(req: Request): { apiKey: string | null; bearerToken: string | null; ip: string } {
    const apiKeyHeader = req.headers["x-api-key"];
    const apiKey = typeof apiKeyHeader === "string" ? apiKeyHeader.trim() : null;

    const authHeader = req.headers.authorization;
    let bearerToken: string | null = null;
    if (typeof authHeader === "string" && /^Bearer\s+.+$/i.test(authHeader)) {
      bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    }

    return { apiKey, bearerToken, ip: extractIp(req) };
  },

  async buildDeveloperIdentity(req: Request): Promise<DeveloperIdentity> {
    const { apiKey, bearerToken, ip } = this.extractIdentityFromRequest(req);

    if (bearerToken) {
      return this.verifyDeveloperToken(bearerToken, ip);
    }

    if (apiKey) {
      this.validateDeveloperApiKey(apiKey);
      return { developerId: "developer", method: "api_key", ip };
    }

    throw new UnauthorizedError("Developer authentication required. Provide a Bearer token or X-API-Key header.");
  },

  extractAuditContext(req?: Request): { ip: string; userAgent: string } {
    return {
      ip: extractIp(req),
      userAgent: extractUserAgent(req),
    };
  },
};
