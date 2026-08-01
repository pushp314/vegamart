import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export type RefreshTokenCreateInput = Prisma.RefreshTokenUncheckedCreateInput;

export async function createRefreshToken(data: RefreshTokenCreateInput) {
  return prisma.refreshToken.create({ data });
}

export async function findByTokenHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
  });
}

export async function revoke(id: string) {
  return prisma.refreshToken.update({
    where: { id },
    data: { revoked_at: new Date() },
  });
}

export async function revokeAllForSession(sessionId: string) {
  return prisma.refreshToken.updateMany({
    where: { session_id: sessionId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function revokeAllForUser(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { user: { id: userId }, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}
