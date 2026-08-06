import log from "../config/logger";

import { sendEmail } from "../emails/mailer";
import {
  orderConfirmationTemplate,
  otpTemplate,
  passwordResetTemplate,
  paymentSuccessTemplate,
  vendorApprovedTemplate,
  vendorRejectedTemplate,
  vendorWelcomeTemplate,
  deliveryWelcomeTemplate,
  verifyEmailTemplate,
  welcomeTemplate,
} from "../emails/templates";

export const emailService = {
  sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const tpl = welcomeTemplate(name);
    return sendEmail({ to: email, ...tpl });
  },

  sendVendorWelcomeEmail(
    email: string,
    input: { name: string; businessName: string }
  ): Promise<boolean> {
    const tpl = vendorWelcomeTemplate(input);
    return sendEmail({ to: email, ...tpl });
  },

  sendDeliveryWelcomeEmail(email: string, name: string): Promise<boolean> {
    const tpl = deliveryWelcomeTemplate(name);
    return sendEmail({ to: email, ...tpl });
  },

  sendVerifyEmailToken(email: string, token: string): Promise<boolean> {
    const tpl = verifyEmailTemplate(token);
    log.info(`[email] Verification token sent to ${email}`);
    return sendEmail({ to: email, ...tpl });
  },

  sendPasswordResetOtp(email: string, otp: string, expiresInMinutes: number): Promise<boolean> {
    const tpl = passwordResetTemplate(otp, expiresInMinutes);
    log.info(`[email] Password reset OTP sent to ${email}`);
    return sendEmail({ to: email, ...tpl });
  },

  sendOtp(email: string, otp: string, purposeLabel: string, expiresInMinutes: number): Promise<boolean> {
    const tpl = otpTemplate(otp, purposeLabel, expiresInMinutes);
    log.info(`[email] OTP (${purposeLabel}) sent to ${email}`);
    return sendEmail({ to: email, ...tpl });
  },

  sendOrderConfirmation(
    email: string,
    input: { name: string; orderNumber: string; total: string; itemsSummary: string; eta?: string | null }
  ): Promise<boolean> {
    const tpl = orderConfirmationTemplate(input);
    return sendEmail({ to: email, ...tpl });
  },

  sendPaymentSuccess(
    email: string,
    input: { name: string; orderNumber: string; amount: string; paymentId?: string | null }
  ): Promise<boolean> {
    const tpl = paymentSuccessTemplate(input);
    return sendEmail({ to: email, ...tpl });
  },

  sendVendorApproved(email: string, input: { name: string; businessName: string }): Promise<boolean> {
    const tpl = vendorApprovedTemplate(input);
    return sendEmail({ to: email, ...tpl });
  },

  sendVendorRejected(email: string, input: { name: string; businessName: string; reason: string | null }): Promise<boolean> {
    const tpl = vendorRejectedTemplate(input);
    return sendEmail({ to: email, ...tpl });
  },
};
