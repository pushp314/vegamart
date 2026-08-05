import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export type AuditLogCreateInput = Prisma.AuditLogUncheckedCreateInput;

export async function createAuditLog(data: AuditLogCreateInput) {
  return prisma.auditLog.create({ data });
}

export async function findRecent(userId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  q?: string;
}

export async function listAuditLogs(
  filter: AuditLogFilter,
  skip: number,
  take: number
): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
  const where: Prisma.AuditLogWhereInput = {};

  if (filter.userId) where.user_id = filter.userId;
  if (filter.action) where.action = filter.action;
  if (filter.entityType) where.entity_type = filter.entityType;
  if (filter.entityId) where.entity_id = filter.entityId;
  if (filter.from || filter.to) {
    where.created_at = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }
  if (filter.q) {
    where.OR = [
      { action: { contains: filter.q, mode: "insensitive" } },
      { entity_type: { contains: filter.q, mode: "insensitive" } },
      { entity_id: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: {
        id: true,
        user_id: true,
        actor_type: true,
        action: true,
        entity_type: true,
        entity_id: true,
        old_values: true,
        new_values: true,
        ip_address: true,
        user_agent: true,
        request_id: true,
        created_at: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows: rows as unknown as Array<Record<string, unknown>>, total };
}

export async function findAuditLogById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}
