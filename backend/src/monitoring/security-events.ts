import type { Request } from "express";

import log from "../config/logger";

export interface SecurityEventMeta {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

/**
 * Security-relevant events (auth failures, lockouts, suspicious logins,
 * rate-limit hits, blocked origins/IPS, etc.) are emitted to a dedicated
 * "security" log file so they can be monitored and alerted on independently.
 */
export function logSecurityEvent(event: string, meta: SecurityEventMeta = {}): void {
  log.warn(`[SECURITY] ${event}`, {
    context: "security",
    requestId: meta.requestId,
    userId: meta.userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    security_event: event,
    ...meta,
  });
}

export function securityEventFromReq(event: string, req: Request, extra: Record<string, unknown> = {}): void {
  logSecurityEvent(event, {
    requestId: req.requestId,
    userId: (req.user as { id?: string } | undefined)?.id,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    ...extra,
  });
}
