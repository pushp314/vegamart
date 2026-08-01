import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export type SessionCreateInput = Prisma.SessionUncheckedCreateInput;

export async function createSession(data: SessionCreateInput) {
  return prisma.session.create({ data });
}

export async function findActiveById(id: string) {
  return prisma.session.findUnique({
    where: { id, is_active: true },
  });
}

export async function findByUserId(userId: string) {
  return prisma.session.findMany({
    where: { user_id: userId, is_active: true },
    orderBy: { last_activity_at: "desc" },
  });
}

export async function countActive(userId: string): Promise<number> {
  return prisma.session.count({
    where: { user_id: userId, is_active: true },
  });
}

export async function updateLastActivity(id: string) {
  return prisma.session.update({
    where: { id },
    data: { last_activity_at: new Date() },
  });
}

export async function revoke(id: string) {
  return prisma.session.update({
    where: { id },
    data: { is_active: false },
  });
}

export async function revokeAllForUser(userId: string, exceptId?: string) {
  return prisma.session.updateMany({
    where: { user_id: userId, is_active: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { is_active: false },
  });
}
