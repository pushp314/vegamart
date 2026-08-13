import type { Request, Response } from "express";

import { authService, AuthSessionResult } from "../services/auth.service";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "../services/google-oauth.service";
import { sendNoContent, sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import asyncHandler from "../utils/asyncHandler";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "../utils/cookies";
import { HttpStatus } from "../utils/httpStatus";
import type {
  ChangePasswordBody,
  GoogleCallbackBody,
  LoginBody,
  LoginWithOtpBody,
  RegisterBody,
  ResetPasswordBody,
} from "../validators/auth.validators";

function respondWithSession(res: Response, session: AuthSessionResult, status: number = HttpStatus.OK): Response {
  setRefreshTokenCookie(res, session.refresh_token);
  return sendSuccess(res, session, { status });
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Create a new account
 *     description: Registers a customer account and returns a session. Vendor and delivery
 *                  self-registration is not supported; use the admin onboarding flow instead.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               password: { type: string, format: password }
 *               role: { type: string, enum: [customer] }
 *     responses:
 *       201:
 *         description: Account created and session issued.
 *       409:
 *         $ref: "#/components/responses/ValidationError"
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegisterBody;
  const session = await authService.register(body, req);
  return respondWithSession(res, session, HttpStatus.CREATED);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginBody;
  const session = await authService.login(body.email, body.password, req);
  return respondWithSession(res, session);
});

/**
 * @swagger
 * /auth/login/otp:
 *   post:
 *     summary: Complete OTP-based login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: OTP login successful.
 */
export const loginWithOtp = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginWithOtpBody;
  const session = await authService.loginWithOtp(body.email, body.otp, req);
  return respondWithSession(res, session);
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rotate the refresh token and issue a new session
 *     description: Accepts the HTTP-only refresh token cookie or a refresh_token in the body.
 *     tags: [Auth]
 *     security:
 *       - refreshCookieAuth: []
 *     responses:
 *       200:
 *         description: New access + refresh tokens issued.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { refresh_token?: string };
  const cookieToken = (req.cookies?.refresh_token as string | undefined) ?? "";
  const token = body.refresh_token ?? cookieToken;
  const session = await authService.refresh(token, req);
  return respondWithSession(res, session);
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoke the current session
 *     description: Requires the refresh token cookie (or refresh_token in body).
 *     tags: [Auth]
 *     security:
 *       - refreshCookieAuth: []
 *     responses:
 *       204:
 *         description: Logged out.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { refresh_token?: string };
  await authService.logout(body.refresh_token, req);
  clearRefreshTokenCookie(res);
  return sendNoContent(res);
});

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Revoke all sessions for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: All sessions revoked.
 */
export const logoutFromAllDevices = asyncHandler(async (req: Request, res: Response) => {
  await authService.logoutFromAllDevices(req.user!.id, req);
  clearRefreshTokenCookie(res);
  return sendNoContent(res);
});

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify an email address with a token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Email verified.
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  const result = await authService.verifyEmail(token);
  return sendSuccess(res, result);
});

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend the email verification token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Verification email (re)sent.
 */
export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.sendEmailVerification(req.user!.id, email, req);
  return sendSuccess(res, { sent: true });
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset OTP sent (if the account exists).
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.forgotPassword(email, req);
  return sendSuccess(res, { sent: true });
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset the password using an OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, password]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Password reset successfully.
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResetPasswordBody;
  await authService.resetPassword(body.email, body.otp, body.password, req);
  return sendSuccess(res, { reset: true });
});

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change the current password
 *     security:
 *       - bearerAuth: []
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string, format: password }
 *               new_password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Password changed.
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChangePasswordBody;
  await authService.changePassword(req.user!, body.current_password, body.new_password, req);
  return sendSuccess(res, { changed: true });
});

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Send an OTP for a given purpose
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, purpose]
 *             properties:
 *               identifier: { type: string }
 *               purpose: { type: string, enum: [EMAIL_VERIFICATION, PHONE_VERIFICATION, PASSWORD_RESET, LOGIN] }
 *     responses:
 *       200:
 *         description: OTP sent.
 */
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { identifier: string; purpose: import("@prisma/client").OtpPurpose };
  await authService.resendOtp(body.identifier, body.purpose, req);
  return sendSuccess(res, { sent: true });
});

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Verify an OTP for a given purpose
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, purpose, otp]
 *             properties:
 *               identifier: { type: string }
 *               purpose: { type: string, enum: [EMAIL_VERIFICATION, PHONE_VERIFICATION, PASSWORD_RESET, LOGIN] }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: OTP verified.
 */
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { identifier: string; purpose: import("@prisma/client").OtpPurpose; otp: string };
  await authService.verifyOtp(body.identifier, body.purpose, body.otp);
  return sendSuccess(res, { verified: true });
});

/**
 * @swagger
 * /auth/guest:
 *   post:
 *     summary: Create a guest session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Guest session issued.
 */
export const createGuestSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await authService.createGuestSession(req);
  return respondWithSession(res, session);
});

/**
 * @swagger
 * /auth/google/url:
 *   get:
 *     summary: Get the Google OAuth authorization URL
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Authorization URL ready to redirect the browser to Google.
 *       503:
 *         description: Google OAuth is not configured on the server.
 */
export const googleAuthUrl = asyncHandler(async (_req: Request, res: Response) => {
  if (!isGoogleOAuthConfigured()) {
    throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Google OAuth is not configured on this server.", {
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    });
  }
  const { url } = buildGoogleAuthUrl();
  return sendSuccess(res, { url });
});

/**
 * @swagger
 * /auth/google/callback:
 *   post:
 *     summary: Complete Google OAuth login with an authorization code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Session issued for the Google account.
 *       401:
 *         description: Invalid or expired authorization code.
 */
export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as GoogleCallbackBody;
  const session = await authService.googleLogin(code, req);
  return respondWithSession(res, session);
});
