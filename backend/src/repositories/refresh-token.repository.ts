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

/**
 * Atomically rotate a refresh token: mark the old record as revoked and point it
 * at its replacement in a single conditional UPDATE so only one concurrent refresh
 * wins. Returns true if this caller performed the rotation, false if another
 * request already rotated the token (a reuse or a race).
 */
export async function rotate(oldId: string, newId: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { id: oldId, revoked_at: null, replaced_by: null },
    data: { revoked_at: new Date(), replaced_by: newId },
  });
  return result.count === 1;
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

export async function revokeAllForUserExceptSession(userId: string, sessionId: string) {
  return prisma.refreshToken.updateMany({
    where: {
      user: { id: userId },
      revoked_at: null,
      NOT: { session_id: sessionId },
    },
    data: { revoked_at: new Date() },
  });
}
