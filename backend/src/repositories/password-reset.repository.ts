import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export type PasswordResetCreateInput = Prisma.PasswordResetTokenUncheckedCreateInput;

export async function findByTokenHash(tokenHash: string) {
  return prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });
}

export async function createPasswordResetToken(data: PasswordResetCreateInput) {
  return prisma.passwordResetToken.create({ data });
}

export async function markUsed(id: string) {
  return prisma.passwordResetToken.update({
    where: { id },
    data: { is_used: true, used_at: new Date() },
  });
}

export async function revokeActiveForUser(userId: string) {
  return prisma.passwordResetToken.updateMany({
    where: { user_id: userId, is_used: false },
    data: { is_used: true, used_at: new Date() },
  });
}
