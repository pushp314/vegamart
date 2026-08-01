import type { OtpPurpose } from "@prisma/client";

import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES } from "../constants";
import {
  createOtp,
  findLatest,
  incrementAttempts,
  markUsed,
  revokeActiveFor,
} from "../repositories/otp.repository";
import { ApiError, ValidationError } from "../utils/ApiError";
import { generateOtp, safeEqual, sha256Hex } from "../utils/crypto";
import { HttpStatus } from "../utils/httpStatus";

const OTP_PURPOSE_LABELS: Record<OtpPurpose, string> = {
  EMAIL_VERIFICATION: "Email verification",
  PHONE_VERIFICATION: "Phone verification",
  PASSWORD_RESET: "Password reset",
  LOGIN: "Login",
};

export interface GeneratedOtp {
  plain: string;
  expiresAt: Date;
}

export async function generateAndStoreOtp(
  identifier: string,
  purpose: OtpPurpose
): Promise<GeneratedOtp> {
  const plain = generateOtp(OTP_LENGTH);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await revokeActiveFor(identifier, purpose);
  await createOtp({
    identifier,
    purpose,
    otp_hash: sha256Hex(plain),
    expires_at: expiresAt,
    attempts: 0,
  });

  return { plain, expiresAt };
}

export async function verifyOtp(
  identifier: string,
  purpose: OtpPurpose,
  otp: string
): Promise<void> {
  const record = await findLatest(identifier, purpose);

  if (!record) {
    throw new ValidationError({ otp: "No active code found for this identifier." });
  }

  if (record.is_used) {
    throw new ValidationError({ otp: "This code has already been used." });
  }

  if (record.expires_at.getTime() < Date.now()) {
    throw new ValidationError({ otp: "This code has expired. Please request a new one." });
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(
      HttpStatus.TOO_MANY_REQUESTS,
      "Too many incorrect attempts. Please request a new code.",
      { code: "OTP_ATTEMPTS_EXCEEDED" }
    );
  }

  const hash = sha256Hex(otp);
  if (!safeEqual(hash, record.otp_hash)) {
    await incrementAttempts(record.id, record.attempts + 1);
    throw new ValidationError({ otp: "Incorrect code. Please try again." });
  }

  await markUsed(record.id);
}

export function otpPurposeLabel(purpose: OtpPurpose): string {
  return OTP_PURPOSE_LABELS[purpose] ?? "Verification";
}
