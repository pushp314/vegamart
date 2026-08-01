import { env } from "../config";
import { ValidationError } from "./ApiError";
import { hashPassword, verifyPassword } from "./password";

export interface PasswordPolicyResult {
  history: string[];
  changed: boolean;
}

/**
 * Enforces password history (reuse prevention) and records the previous hash
 * into a rolling history ring. The plaintext candidate is compared against the
 * current and historical bcrypt hashes, so a reused password is rejected even
 * though the stored values are salted.
 */
export async function enforcePasswordPolicy(
  currentHash: string,
  currentHistory: unknown,
  newPassword: string
): Promise<PasswordPolicyResult> {
  const historyLimit = env.PASSWORD_HISTORY_LIMIT;
  const parsedHistory: string[] = Array.isArray(currentHistory)
    ? currentHistory.filter((h): h is string => typeof h === "string")
    : [];

  if (await verifyPassword(newPassword, currentHash)) {
    throw new ValidationError({ new_password: "New password must differ from the current password." });
  }

  for (const oldHash of parsedHistory) {
    if (await verifyPassword(newPassword, oldHash)) {
      throw new ValidationError({ new_password: "New password must not be one of your recent passwords." });
    }
  }

  const history = [...parsedHistory, currentHash].slice(-Math.max(0, historyLimit));
  return { history, changed: true };
}

export async function checkPasswordExpiry(passwordChangedAt: Date | null | undefined): Promise<boolean> {
  const days = env.PASSWORD_EXPIRY_DAYS;
  if (days <= 0 || !passwordChangedAt) {
    return false;
  }
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return passwordChangedAt.getTime() < threshold;
}

export { hashPassword };
