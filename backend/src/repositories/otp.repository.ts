import type { Prisma, OtpPurpose } from "@prisma/client";

import prisma from "../database/prisma";

export type OtpCreateInput = Prisma.OtpVerificationUncheckedCreateInput;

export async function findLatest(identifier: string, purpose: OtpPurpose) {
  return prisma.otpVerification.findFirst({
    where: { identifier, purpose },
    orderBy: { created_at: "desc" },
  });
}

export async function findByHash(otpHash: string) {
  return prisma.otpVerification.findFirst({
    where: { otp_hash: otpHash },
    orderBy: { created_at: "desc" },
  });
}

export async function createOtp(data: OtpCreateInput) {
  return prisma.otpVerification.create({ data });
}

export async function markUsed(id: string) {
  return prisma.otpVerification.update({
    where: { id },
    data: { is_used: true, used_at: new Date() },
  });
}

/**
 * Atomically increments the attempt counter, but only while it is below
 * `maxAttempts`. Concurrent wrong guesses serialise on the row: exactly one of
 * them wins the increment, so no caller can read a stale counter and exceed the
 * maximum-attempt budget.
 *
 * Returns `true` when the counter was incremented, `false` when it is already at
 * (or past) the maximum.
 */
export async function incrementAttemptsIfBelow(id: string, maxAttempts: number): Promise<boolean> {
  const result = await prisma.otpVerification.updateMany({
    where: { id, attempts: { lt: maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  return result.count > 0;
}

export async function revokeActiveFor(identifier: string, purpose: OtpPurpose) {
  return prisma.otpVerification.updateMany({
    where: { identifier, purpose, is_used: false },
    data: { is_used: true, used_at: new Date() },
  });
}
