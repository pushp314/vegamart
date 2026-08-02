import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../constants";
import { PASSWORD_RULES } from "../constants/auth";
import { OtpPurpose } from "@prisma/client";

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone must be 10-15 digits, optionally prefixed with +.")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(PASSWORD_RULES.MIN_LENGTH, `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters.`)
    .max(PASSWORD_RULES.MAX_LENGTH, "Password must be at most 72 characters."),
  role: z.enum(["customer", "vendor", "delivery"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  password: z.string().min(1, "Password is required."),
});

export const loginWithOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
});

export const refreshSchema = z.object({
  refresh_token: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "token is required."),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
});

export const googleCallbackSchema = z.object({
  code: z.string().trim().min(1, "code is required.").max(5000),
});

export type GoogleCallbackBody = z.infer<typeof googleCallbackSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required."),
  new_password: passwordSchema,
});

export const resendOtpSchema = z.object({
  identifier: z.string().min(1, "identifier is required."),
  purpose: z.nativeEnum(OtpPurpose),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().min(1, "identifier is required."),
  purpose: z.nativeEnum(OtpPurpose),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type LoginWithOtpBody = z.infer<typeof loginWithOtpSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
