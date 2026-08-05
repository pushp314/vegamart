import type { Request } from "express";
import { OtpPurpose, UserStatus } from "@prisma/client";

import { env } from "../config";
import { GUEST_USER_ID, OTP_TTL_MINUTES } from "../constants";
import { AUDIT_ACTIONS, EMAIL_VERIFY_TOKEN_BYTES } from "../constants/auth";
import { emailService } from "./email.service";
import { auditService } from "./audit.service";
import { exchangeGoogleCode } from "./google-oauth.service";
import { generateAndStoreOtp, otpPurposeLabel, verifyOtp } from "./otp.service";
import { createRefreshToken, hashRefreshToken, isValidRefreshTokenFormat, signAccessToken } from "./token.service";
import { createSession, countActive as countActiveSessionsForUser, findActiveById, revoke, revokeAllForUser as revokeAllSessionsForUser, updateLastActivity } from "../repositories/session.repository";
import { createRefreshToken as createRefreshTokenRepo, findByTokenHash, revoke as revokeRefreshToken, revokeAllForSession, revokeAllForUser as revokeAllTokensForUser } from "../repositories/refresh-token.repository";
import { findBySlug as findRoleBySlug } from "../repositories/role.repository";
import { createOtp, findByHash as findOtpByHash, markUsed as markOtpUsed, revokeActiveFor } from "../repositories/otp.repository";
import { create as createUserRepo, findByEmail, findById as findUserById, incrementLoginFailures, markEmailVerified, resetLoginFailures, setLastLogin, setLocked, update as updateUserRepo, updatePassword, UserWithRoleAndPermissions } from "../repositories/user.repository";
import { assertStrongPassword, hashPassword, normalizeEmail, verifyPassword } from "../utils/password";
import { checkPasswordExpiry, enforcePasswordPolicy } from "../utils/password-policy";
import { ApiError, ForbiddenError, UnauthorizedError, ValidationError } from "../utils/ApiError";
import { generateOpaqueToken, sha256Hex } from "../utils/crypto";
import { parseDeviceInfo } from "../utils/device";
import { HttpStatus } from "../utils/httpStatus";
import { serializeUser, SerializedUser } from "../utils/serializeUser";
import { parseDurationToMs } from "../utils/time";
import type { AuthUser } from "../types";
import { securityEventFromReq } from "../monitoring/security-events";

export interface AuthSessionResult {
  access_token: string;
  refresh_token: string;
  user: SerializedUser;
  warning?: { code: string; message: string };
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: string;
}

const SELF_SERVICE_ROLES = new Set(["customer", "vendor", "delivery"]);

async function getUserProfile(userId: string): Promise<SerializedUser> {
  const user = await findUserById(userId, { role: true, vendor: true, delivery: true });
  if (!user) {
    throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
  }
  return serializeUser(user);
}

function userToAuthUser(user: UserWithRoleAndPermissions): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.slug,
    role_id: user.role_id,
    permissions: user.role.role_permissions.map((p) => p.permission.slug),
    vendor_id: user.vendor_profile?.id ?? null,
    delivery_id: user.delivery_profile?.id ?? null,
    is_verified: user.is_verified,
  };
}

async function createSessionAndTokens(userId: string, req: Request): Promise<AuthSessionResult> {
  const device = parseDeviceInfo(req);
  const refresh = createRefreshToken();
  const refreshExpiry = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));

  const session = await createSession({
    user_id: userId,
    device_name: device.device_name,
    device_type: device.device_type,
    ip_address: device.ip_address,
    user_agent: device.user_agent,
    is_active: true,
  });

  await createRefreshTokenRepo({
    user_id: userId,
    token_hash: refresh.token_hash,
    session_id: session.id,
    expires_at: refreshExpiry,
    ip_address: device.ip_address,
    user_agent: device.user_agent,
  });

  const user = await findUserById(userId, { role: true });
  const roleSlug = user?.role.slug ?? "customer";

  const accessToken = signAccessToken({
    sub: userId,
    email: user?.email ?? "",
    role: roleSlug,
    session_id: session.id,
  });

  const activeSessions = await countActiveSessionsForUser(userId);
  if (activeSessions >= env.LOGIN_DEVICE_THRESHOLD) {
    securityEventFromReq("DEVICE_LIMIT_REACHED", req, {
      userId,
      sessionId: session.id,
      activeSessions,
      threshold: env.LOGIN_DEVICE_THRESHOLD,
    });
  }

  return {
    access_token: accessToken,
    refresh_token: refresh.token,
    user: await getUserProfile(userId),
  };
}

export const authService = {
  async register(input: RegisterInput, req: Request): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    const role = input.role ?? "customer";

    if (!SELF_SERVICE_ROLES.has(role)) {
      throw new ValidationError({ role: "Role must be one of: customer, vendor, delivery." });
    }

    assertStrongPassword(input.password);

    const existingEmail = await findByEmail(email);
    if (existingEmail) {
      throw new ApiError(HttpStatus.CONFLICT, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    if (input.phone) {
      const { findByPhone } = await import("../repositories/user.repository");
      const existingPhone = await findByPhone(input.phone);
      if (existingPhone) {
        throw new ApiError(HttpStatus.CONFLICT, "An account with this phone already exists.", {
          code: "PHONE_TAKEN",
        });
      }
    }

    const roleRow = await findRoleBySlug(role);
    if (!roleRow) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, `Role "${role}" is not configured.`, {
        code: "ROLE_NOT_FOUND",
        expose: false,
      });
    }

    const passwordHash = await hashPassword(input.password);

    const user = await createUserRepo({
      name: input.name.trim(),
      email,
      phone: input.phone ?? undefined,
      password_hash: passwordHash,
      role: { connect: { id: roleRow.id } },
      is_verified: false,
      provider: "local",
    });

    await auditService.record(
      {
        userId: user.id,
        action: AUDIT_ACTIONS.USER_REGISTERED,
        entityType: "user",
        entityId: user.id,
        newValues: { email, role },
      },
      req
    );

    const session = await createSessionAndTokens(user.id, req);

    void emailService.sendWelcomeEmail(user.email, user.name);

    if (env.EMAIL_VERIFICATION_REQUIRED) {
      await this.sendEmailVerification(user.id, email, req);
    }

    return session;
  },

  async login(emailInput: string, password: string, req: Request): Promise<AuthSessionResult> {
    const email = normalizeEmail(emailInput);
    const user = await findByEmail(email);

    if (!user || user.deleted_at) {
      await auditService.record(
        { userId: user?.id, action: AUDIT_ACTIONS.USER_LOGIN_FAILED, entityType: "user", entityId: user?.id },
        req
      );
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new ForbiddenError("This account has been suspended. Contact support.");
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((user.locked_until.getTime() - Date.now()) / 1000);
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Account temporarily locked due to too many failed attempts.", {
        code: "ACCOUNT_LOCKED",
        details: { retry_after: String(retryAfterSeconds) },
      });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      const attempts = user.failed_login_attempts + 1;
      await incrementLoginFailures(user.id);

      if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60 * 1000);
        await setLocked(user.id, lockedUntil);
        await auditService.record(
          { userId: user.id, action: AUDIT_ACTIONS.USER_LOGIN_FAILED, entityType: "user", entityId: user.id },
          req
        );
        throw new ApiError(
          HttpStatus.UNAUTHORIZED,
          `Too many failed attempts. Account locked for ${env.ACCOUNT_LOCK_MINUTES} minutes.`,
          { code: "ACCOUNT_LOCKED", details: { retry_after: String(env.ACCOUNT_LOCK_MINUTES * 60) } }
        );
      }

      await auditService.record(
        { userId: user.id, action: AUDIT_ACTIONS.USER_LOGIN_FAILED, entityType: "user", entityId: user.id },
        req
      );
      throw new UnauthorizedError("Invalid email or password.");
    }

    await resetLoginFailures(user.id);
    await setLastLogin(user.id);

    await auditService.record(
      { userId: user.id, action: AUDIT_ACTIONS.USER_LOGIN_SUCCESS, entityType: "user", entityId: user.id },
      req
    );

    const session = await createSessionAndTokens(user.id, req);

    if (await checkPasswordExpiry(user.password_changed_at)) {
      session.warning = { code: "PASSWORD_EXPIRING", message: "Your password is older than the maximum allowed age. Please change it." };
    }

    return session;
  },

  async loginWithOtp(emailInput: string, otp: string, req: Request): Promise<AuthSessionResult> {
    const email = normalizeEmail(emailInput);
    await verifyOtp(email, OtpPurpose.LOGIN, otp);

    const user = await findByEmail(email);
    if (!user || user.deleted_at) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new ForbiddenError("This account has been suspended. Contact support.");
    }

    await setLastLogin(user.id);
    await auditService.record(
      { userId: user.id, action: AUDIT_ACTIONS.USER_LOGIN_OTP_VERIFIED, entityType: "user", entityId: user.id },
      req
    );

    return createSessionAndTokens(user.id, req);
  },

  async googleLogin(code: string, req: Request): Promise<AuthSessionResult> {
    const profile = await exchangeGoogleCode(code);
    if (!profile.email) {
      throw new UnauthorizedError("Google account has no verified email address.");
    }

    let user = await findByEmail(profile.email);

    if (!user || user.deleted_at) {
      const roleRow = await findRoleBySlug("customer");
      if (!roleRow) {
        throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, `Role "customer" is not configured.`, {
          code: "ROLE_NOT_FOUND",
          expose: false,
        });
      }
      user = await createUserRepo({
        name: profile.name || profile.email.split("@")[0] || "Google User",
        email: profile.email,
        password_hash: generateOpaqueToken(32),
        is_verified: profile.email_verified,
        email_verified_at: profile.email_verified ? new Date() : null,
        avatar_url: profile.picture,
        provider: "google",
        provider_id: profile.sub,
        role: { connect: { id: roleRow.id } },
      });
      await auditService.record(
        { userId: user.id, action: AUDIT_ACTIONS.USER_REGISTERED, entityType: "user", entityId: user.id, newValues: { email: profile.email, role: "customer", provider: "google" } },
        req
      );
      void emailService.sendWelcomeEmail(profile.email, user.name);
      return createSessionAndTokens(user.id, req);
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new ForbiddenError("This account has been suspended. Contact support.");
    }

    if (user.provider !== "google" || !user.provider_id) {
      await updateUserRepo(user.id, {
        provider: "google",
        provider_id: profile.sub,
        ...(profile.picture && !user.avatar_url ? { avatar_url: profile.picture } : {}),
      });
    }

    if (profile.email_verified && !user.is_verified) {
      await markEmailVerified(user.id);
    }

    await setLastLogin(user.id);
    await resetLoginFailures(user.id);
    await auditService.record(
      { userId: user.id, action: AUDIT_ACTIONS.USER_LOGIN_GOOGLE, entityType: "user", entityId: user.id, newValues: { provider: "google" } },
      req
    );

    return createSessionAndTokens(user.id, req);
  },

  async refresh(refreshToken: string, req: Request): Promise<AuthSessionResult> {
    if (!refreshToken || !isValidRefreshTokenFormat(refreshToken)) {
      throw new UnauthorizedError("Invalid refresh token.");
    }

    const record = await findByTokenHash(hashRefreshToken(refreshToken));

    if (!record || record.revoked_at || record.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token is invalid or expired.");
    }

    const session = record.session_id ? await findActiveById(record.session_id) : null;
    if (!session) {
      await revokeRefreshToken(record.id);
      throw new UnauthorizedError("Session is no longer active.");
    }

    const user = await findUserById(record.user_id, { role: true });
    if (!user || user.deleted_at) {
      throw new UnauthorizedError("User no longer exists.");
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED || user.status === UserStatus.INACTIVE) {
      await revokeRefreshToken(record.id);
      throw new UnauthorizedError("Your account is no longer active.");
    }

    await revokeRefreshToken(record.id);

    const refresh = createRefreshToken();
    const refreshExpiry = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
    await createRefreshTokenRepo({
      user_id: user.id,
      token_hash: refresh.token_hash,
      session_id: session.id,
      expires_at: refreshExpiry,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
    });

    await updateLastActivity(session.id);

    await auditService.record(
      { userId: user.id, action: AUDIT_ACTIONS.REFRESH_TOKEN_USED, entityType: "user", entityId: user.id },
      req
    );

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role.slug,
      session_id: session.id,
    });

    return {
      access_token: accessToken,
      refresh_token: refresh.token,
      user: await getUserProfile(user.id),
    };
  },

  async logout(refreshToken: string | undefined, req: Request): Promise<void> {
    const token = refreshToken || (req.cookies?.refresh_token as string | undefined);
    if (!token) {
      return;
    }

    if (isValidRefreshTokenFormat(token)) {
      const record = await findByTokenHash(hashRefreshToken(token));
      if (record) {
        await revokeRefreshToken(record.id);
        if (record.session_id) {
          await revoke(record.session_id);
          await revokeAllForSession(record.session_id);
        }
        await auditService.record(
          { userId: record.user_id, action: AUDIT_ACTIONS.USER_LOGOUT, entityType: "user", entityId: record.user_id },
          req
        );
      }
    }
  },

  async logoutFromAllDevices(userId: string, req: Request): Promise<void> {
    await revokeAllSessionsForUser(userId);
    await revokeAllTokensForUser(userId);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.USER_LOGOUT_ALL, entityType: "user", entityId: userId },
      req
    );
  },

  async verifyEmail(token: string): Promise<{ email: string }> {
    const tokenHash = sha256Hex(token);
    const record = await findOtpByHash(tokenHash);

    if (!record || record.purpose !== OtpPurpose.EMAIL_VERIFICATION) {
      throw new ValidationError({ token: "Invalid or expired verification token." });
    }
    if (record.is_used) {
      throw new ValidationError({ token: "Verification token has already been used." });
    }
    if (record.expires_at.getTime() < Date.now()) {
      throw new ValidationError({ token: "Verification token has expired." });
    }

    const user = await findByEmail(record.identifier);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }

    await markOtpUsed(record.id);
    await markEmailVerified(user.id);

    return { email: user.email };
  },

  async sendEmailVerification(userId: string, emailInput: string, req?: Request): Promise<string> {
    const email = normalizeEmail(emailInput);
    const token = generateOpaqueToken(EMAIL_VERIFY_TOKEN_BYTES);
    const expiresAt = new Date(Date.now() + env.VERIFY_EMAIL_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await revokeActiveFor(email, OtpPurpose.EMAIL_VERIFICATION);
    await createOtp({
      identifier: email,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      otp_hash: sha256Hex(token),
      expires_at: expiresAt,
      attempts: 0,
    });

    void emailService.sendVerifyEmailToken(email, token);
    await auditService.record(
      { userId, action: AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT, entityType: "user", entityId: userId },
      req
    );

    return token;
  },

  async forgotPassword(emailInput: string, req: Request): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await findByEmail(email);
    if (!user) {
      return;
    }

    const { plain } = await generateAndStoreOtp(email, OtpPurpose.PASSWORD_RESET);
    void emailService.sendPasswordResetOtp(email, plain, OTP_TTL_MINUTES);
    await auditService.record(
      { userId: user.id, action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED, entityType: "user", entityId: user.id },
      req
    );
  },

  async resetPassword(emailInput: string, otp: string, newPassword: string, req: Request): Promise<void> {
    const email = normalizeEmail(emailInput);
    assertStrongPassword(newPassword);

    await verifyOtp(email, OtpPurpose.PASSWORD_RESET, otp);

    const user = await findByEmail(email);
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found.", { code: "NOT_FOUND" });
    }

    const passwordHash = await hashPassword(newPassword);
    const { history } = await enforcePasswordPolicy(
      user.password_hash,
      user.password_history,
      newPassword
    );
    await updatePassword(user.id, passwordHash, history);
    await resetLoginFailures(user.id);

    await revokeAllSessionsForUser(user.id);
    await revokeAllTokensForUser(user.id);

    await auditService.record(
      { userId: user.id, action: AUDIT_ACTIONS.PASSWORD_RESET, entityType: "user", entityId: user.id },
      req
    );
  },

  async changePassword(
    authUser: AuthUser,
    currentPassword: string,
    newPassword: string,
    req: Request
  ): Promise<void> {
    assertStrongPassword(newPassword);

    const dbUser = await findUserById(authUser.id);
    if (!dbUser) {
      throw new UnauthorizedError("User not found.");
    }

    const valid = await verifyPassword(currentPassword, dbUser.password_hash);
    if (!valid) {
      throw new ValidationError({ current_password: "Current password is incorrect." });
    }

    const passwordHash = await hashPassword(newPassword);
    const { history } = await enforcePasswordPolicy(
      dbUser.password_hash,
      dbUser.password_history,
      newPassword
    );
    await updatePassword(authUser.id, passwordHash, history);

    await auditService.record(
      { userId: authUser.id, action: AUDIT_ACTIONS.PASSWORD_CHANGED, entityType: "user", entityId: authUser.id },
      req
    );
  },

  async resendOtp(identifier: string, purpose: OtpPurpose, req: Request): Promise<void> {
    const { plain } = await generateAndStoreOtp(identifier, purpose);
    void emailService.sendOtp(identifier, plain, otpPurposeLabel(purpose), OTP_TTL_MINUTES);
    await auditService.record(
      { action: AUDIT_ACTIONS.OTP_SENT, entityType: "otp", entityId: identifier },
      req
    );
  },

  async verifyOtp(identifier: string, purpose: OtpPurpose, otp: string): Promise<void> {
    await verifyOtp(identifier, purpose, otp);
  },

  async createGuestSession(req: Request): Promise<AuthSessionResult> {
    const refresh = createRefreshToken();

    await auditService.record({ action: AUDIT_ACTIONS.GUEST_LOGIN }, req);

    const accessToken = signAccessToken({
      sub: GUEST_USER_ID,
      email: "guest@galiconnect.local",
      role: "customer",
      session_id: `guest-${refresh.token_hash.slice(0, 16)}`,
      guest: true,
    });

    return {
      access_token: accessToken,
      refresh_token: refresh.token,
      user: {
        id: GUEST_USER_ID,
        name: "Guest",
        email: "guest@galiconnect.local",
        phone: null,
        role: "customer",
        avatar_url: null,
        is_verified: false,
        provider: "local",
        created_at: new Date().toISOString(),
      },
    };
  },

  toAuthUser(user: UserWithRoleAndPermissions): AuthUser {
    return userToAuthUser(user);
  },
};
