import { Router } from "express";

import {
  changePassword,
  createGuestSession,
  forgotPassword,
  googleAuthUrl,
  googleCallback,
  login,
  loginWithOtp,
  logout,
  logoutFromAllDevices,
  refresh,
  register,
  resendVerification,
  resetPassword,
  sendOtp,
  verifyEmail,
  verifyOtp as verifyOtpHandler,
} from "../../controllers/auth.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authLimiter, otpLimiter } from "../../middlewares/rate-limit.middleware";
import { validate } from "../../middlewares/validate";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleCallbackSchema,
  loginSchema,
  loginWithOtpSchema,
  refreshSchema,
  registerSchema,
  resendOtpSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from "../../validators/auth.validators";

const router = Router();

router.post("/auth/register", authLimiter, validate({ body: registerSchema }), register);
router.post("/auth/login", authLimiter, validate({ body: loginSchema }), login);
router.post("/auth/login/otp", authLimiter, otpLimiter, validate({ body: loginWithOtpSchema }), loginWithOtp);
router.post("/auth/refresh", validate({ body: refreshSchema }), refresh);
router.post("/auth/logout", logout);
router.post("/auth/logout-all", authenticate, logoutFromAllDevices);
router.post("/auth/verify-email", validate({ body: verifyEmailSchema }), verifyEmail);
router.post("/auth/resend-verification", validate({ body: resendVerificationSchema }), resendVerification);
router.post("/auth/forgot-password", authLimiter, otpLimiter, validate({ body: forgotPasswordSchema }), forgotPassword);
router.post("/auth/reset-password", authLimiter, otpLimiter, validate({ body: resetPasswordSchema }), resetPassword);
router.post("/auth/change-password", authenticate, validate({ body: changePasswordSchema }), changePassword);
router.post("/auth/otp/send", authLimiter, otpLimiter, validate({ body: resendOtpSchema }), sendOtp);
router.post("/auth/otp/verify", authLimiter, otpLimiter, validate({ body: verifyOtpSchema }), verifyOtpHandler);
router.post("/auth/guest", createGuestSession);
router.get("/auth/google/url", googleAuthUrl);
router.post("/auth/google/callback", authLimiter, validate({ body: googleCallbackSchema }), googleCallback);

export default router;
