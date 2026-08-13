import type { OtpPurpose } from "@prisma/client";

import { env } from "../config";
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES } from "../constants";
import {
  createOtp,
  findLatest,
  incrementAttemptsIfBelow,
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
  const latest = await findLatest(identifier, purpose);

  // Resend cooldown: block repeated code generation for the same identifier and
  // purpose so an unauthenticated caller cannot spam emails/OTPs. The previous
  // active code is untouched so the user's existing code stays valid.
  if (latest && !latest.is_used && !isExpired(latest.expires_at)) {
    const elapsedMs = Date.now() - latest.created_at.getTime();
    const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.ceil((env.OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        `Too many requests. Please wait ${waitSeconds}s before requesting a new code.`,
        { code: "OTP_RESEND_COOLDOWN", details: { retry_after: String(waitSeconds) } }
      );
    }
  }

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

function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
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

  if (isExpired(record.expires_at)) {
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
    // Atomic bounded increment: concurrent wrong guesses cannot overshoot
    // OTP_MAX_ATTEMPTS because the counter is only incremented while below the
    // max. A `false` return means another request already consumed the last
    // allowed guess.
    const incremented = await incrementAttemptsIfBelow(record.id, OTP_MAX_ATTEMPTS);
    if (!incremented) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        "Too many incorrect attempts. Please request a new code.",
        { code: "OTP_ATTEMPTS_EXCEEDED" }
      );
    }
    throw new ValidationError({ otp: "Incorrect code. Please try again." });
  }

  await markUsed(record.id);
}

export function otpPurposeLabel(purpose: OtpPurpose): string {
  return OTP_PURPOSE_LABELS[purpose] ?? "Verification";
}