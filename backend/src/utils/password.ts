import bcrypt from "bcryptjs";

import { BCRYPT_SALT_ROUNDS, PASSWORD_RULES } from "../constants/auth";
import { ValidationError } from "./ApiError";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface PasswordStrengthIssue {
  code: string;
  message: string;
}

export function validatePasswordStrength(password: string): PasswordStrengthIssue[] {
  const issues: PasswordStrengthIssue[] = [];

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    issues.push({
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters.`,
    });
  }

  if (Buffer.byteLength(password, "utf8") > PASSWORD_RULES.MAX_LENGTH) {
    issues.push({
      code: "PASSWORD_TOO_LONG",
      message: `Password must be at most ${PASSWORD_RULES.MAX_LENGTH} bytes.`,
    });
  }

  if (PASSWORD_RULES.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    issues.push({ code: "PASSWORD_NO_UPPERCASE", message: "Password must contain an uppercase letter." });
  }

  if (PASSWORD_RULES.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    issues.push({ code: "PASSWORD_NO_LOWERCASE", message: "Password must contain a lowercase letter." });
  }

  if (PASSWORD_RULES.REQUIRE_NUMBER && !/\d/.test(password)) {
    issues.push({ code: "PASSWORD_NO_NUMBER", message: "Password must contain a number." });
  }

  if (PASSWORD_RULES.REQUIRE_SPECIAL && !/[^A-Za-z0-9]/.test(password)) {
    issues.push({ code: "PASSWORD_NO_SPECIAL", message: "Password must contain a special character." });
  }

  return issues;
}

export function assertStrongPassword(password: string): void {
  const issues = validatePasswordStrength(password);
  if (issues.length > 0) {
    const details: Record<string, string> = {};
    for (const issue of issues) {
      details[issue.code] = issue.message;
    }
    throw new ValidationError(details, "Password does not meet strength requirements.");
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
