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

export async function incrementAttempts(id: string, attempts: number) {
  return prisma.otpVerification.update({
    where: { id },
    data: { attempts },
  });
}

export async function revokeActiveFor(identifier: string, purpose: OtpPurpose) {
  return prisma.otpVerification.updateMany({
    where: { identifier, purpose, is_used: false },
    data: { is_used: true, used_at: new Date() },
  });
}
