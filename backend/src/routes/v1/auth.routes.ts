import { Router } from "express";

import {
  changePassword,
  createGuestSession,
  forgotPassword,
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
import { authLimiter } from "../../middlewares/rate-limit.middleware";
import { validate } from "../../middlewares/validate";
import {
  changePasswordSchema,
  forgotPasswordSchema,
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
router.post("/auth/login/otp", authLimiter, validate({ body: loginWithOtpSchema }), loginWithOtp);
router.post("/auth/refresh", validate({ body: refreshSchema }), refresh);
router.post("/auth/logout", logout);
router.post("/auth/logout-all", authenticate, logoutFromAllDevices);
router.post("/auth/verify-email", validate({ body: verifyEmailSchema }), verifyEmail);
router.post("/auth/resend-verification", validate({ body: resendVerificationSchema }), resendVerification);
router.post("/auth/forgot-password", authLimiter, validate({ body: forgotPasswordSchema }), forgotPassword);
router.post("/auth/reset-password", authLimiter, validate({ body: resetPasswordSchema }), resetPassword);
router.post("/auth/change-password", authenticate, validate({ body: changePasswordSchema }), changePassword);
router.post("/auth/otp/send", authLimiter, validate({ body: resendOtpSchema }), sendOtp);
router.post("/auth/otp/verify", authLimiter, validate({ body: verifyOtpSchema }), verifyOtpHandler);
router.post("/auth/guest", createGuestSession);

export default router;
