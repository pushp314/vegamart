import type { Request } from "express";

import log from "../config/logger";
import { createAuditLog } from "../repositories/audit-log.repository";

export interface AuditEntry {
  userId?: string;
  actorType?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

function extractRequestContext(req?: Request): { ip: string; userAgent: string; requestId: string } {
  if (!req) {
    return { ip: "", userAgent: "", requestId: "" };
  }
  return {
    ip: req.ip ?? (req.headers["x-forwarded-for"] as string) ?? "",
    userAgent: (req.headers["user-agent"] as string) ?? "",
    requestId: req.requestId ?? "",
  };
}

export const auditService = {
  async record(entry: AuditEntry, req?: Request): Promise<void> {
    const { ip, userAgent, requestId } = extractRequestContext(req);
    try {
      await createAuditLog({
        user_id: entry.userId ?? null,
        actor_type: entry.actorType ?? null,
        action: entry.action,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        old_values: entry.oldValues ? (entry.oldValues as object) : undefined,
        new_values: entry.newValues ? (entry.newValues as object) : undefined,
        ip_address: ip,
        user_agent: userAgent,
        request_id: requestId,
      });
    } catch (error) {
      log.error(`[audit] Failed to persist audit log for action "${entry.action}"`, {
        context: "audit",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
