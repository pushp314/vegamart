import { env } from "../config";
import { APP_NAME } from "../constants";

interface TemplateContext {
  appName: string;
  appUrl: string;
  clientUrl: string;
  year: number;
}

function baseContext(): TemplateContext {
  return {
    appName: env.APP_NAME || APP_NAME,
    appUrl: env.APP_URL,
    clientUrl: env.CLIENT_URL,
    year: new Date().getFullYear(),
  };
}

function layout(title: string, bodyHtml: string): string {
  const { appName, year } = baseContext();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f5f7; margin: 0; padding: 24px; }
  .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .header { background: #16a34a; color: #ffffff; padding: 20px 24px; font-size: 20px; font-weight: 700; }
  .body { padding: 24px; color: #1f2937; font-size: 15px; line-height: 1.6; }
  .footer { padding: 16px 24px; background: #f9fafb; color: #6b7280; font-size: 12px; text-align: center; }
  .otp { font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; margin: 20px 0; color: #16a34a; }
  .button { display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
  a { color: #16a34a; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">${appName}</div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">&copy; ${year} ${appName}. All rights reserved.</div>
  </div>
</body>
</html>`;
}

export function verifyEmailTemplate(token: string): { subject: string; html: string; text: string } {
  const { clientUrl } = baseContext();
  const verifyUrl = `${clientUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your email address";
  const html = layout(
    subject,
    `<h2>Verify your email</h2>
     <p>Thanks for signing up! Please confirm your email address by clicking the button below. This link expires in 24 hours.</p>
     <p style="text-align:center"><a class="button" href="${verifyUrl}">Verify Email</a></p>
     <p>Or copy and paste this link into your browser:</p>
     <p><a href="${verifyUrl}">${verifyUrl}</a></p>`
  );
  const text = `Verify your email address\n\nOpen this link in your browser (valid for 24 hours):\n${verifyUrl}`;
  return { subject, html, text };
}

export function passwordResetTemplate(otp: string, expiresInMinutes: number): { subject: string; html: string; text: string } {
  const subject = "Reset your password";
  const html = layout(
    subject,
    `<h2>Reset your password</h2>
     <p>We received a request to reset the password for your account. Use the OTP below to continue. It expires in ${expiresInMinutes} minutes.</p>
     <div class="otp">${otp}</div>
     <p>If you didn't request this, you can safely ignore this email.</p>`
  );
  const text = `Reset your password\n\nYour OTP is: ${otp}\nIt expires in ${expiresInMinutes} minutes.`;
  return { subject, html, text };
}

export function otpTemplate(otp: string, purposeLabel: string, expiresInMinutes: number): { subject: string; html: string; text: string } {
  const subject = `Your ${purposeLabel} code`;
  const html = layout(
    subject,
    `<h2>${purposeLabel}</h2>
     <p>Use the OTP below to complete this action. It expires in ${expiresInMinutes} minutes.</p>
     <div class="otp">${otp}</div>
     <p>If you didn't request this code, please ignore this email.</p>`
  );
  const text = `Your ${purposeLabel} code is: ${otp}\nIt expires in ${expiresInMinutes} minutes.`;
  return { subject, html, text };
}

export function welcomeTemplate(name: string): { subject: string; html: string; text: string } {
  const subject = `Welcome to ${env.APP_NAME || APP_NAME}!`;
  const html = layout(
    subject,
    `<h2>Welcome, ${name}! 🛒</h2>
     <p>Your account has been created successfully. You can now browse vendors, order groceries and track deliveries right from your neighbourhood.</p>
     <p>Get started by exploring nearby stores on the home screen — fresh produce, groceries and more delivered to your door.</p>
     <p style="text-align:center"><a class="button" href="${baseContext().appUrl}">Start Shopping</a></p>`
  );
  const text = `Welcome, ${name}! Your account has been created successfully. Browse nearby vendors and start ordering from ${baseContext().appUrl}.`;
  return { subject, html, text };
}

export function vendorWelcomeTemplate(input: {
  name: string;
  businessName: string;
}): { subject: string; html: string; text: string } {
  const subject = `Welcome aboard, ${input.businessName}!`;
  const html = layout(
    subject,
    `<h2>Welcome, ${input.name}! 🏪</h2>
     <p>Your vendor account for <strong>${input.businessName}</strong> has been created successfully.</p>
     <p>Here's what happens next:</p>
     <ol>
       <li>Complete your store profile — business hours, location, and logo.</li>
       <li>Submit your KYC documents for verification.</li>
       <li>Once approved, list your products and start accepting orders.</li>
     </ol>
     <p style="text-align:center"><a class="button" href="${baseContext().appUrl}">Open Vendor Portal</a></p>`
  );
  const text = `Welcome, ${input.name}! Your vendor account for ${input.businessName} has been created. Complete your profile, submit KYC and start listing products.`;
  return { subject, html, text };
}

export function deliveryWelcomeTemplate(name: string): { subject: string; html: string; text: string } {
  const subject = `Welcome to the delivery team, ${name}!`;
  const html = layout(
    subject,
    `<h2>Welcome, ${name}! 🛵</h2>
     <p>Your delivery partner account has been created successfully.</p>
     <p>Here's what happens next:</p>
     <ol>
       <li>Complete your delivery profile — phone number and vehicle details.</li>
       <li>Submit your KYC documents for verification.</li>
       <li>Once approved, accept nearby delivery requests and start earning.</li>
     </ol>
     <p style="text-align:center"><a class="button" href="${baseContext().appUrl}">Open Delivery Portal</a></p>`
  );
  const text = `Welcome, ${name}! Your delivery partner account has been created. Complete your profile, submit KYC and start accepting deliveries.`;
  return { subject, html, text };
}

export function orderConfirmationTemplate(input: {
  name: string;
  orderNumber: string;
  total: string;
  itemsSummary: string;
  eta?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `Order ${input.orderNumber} confirmed`;
  const html = layout(
    subject,
    `<h2>Order confirmed 🎉</h2>
     <p>Hi ${input.name}, your order <strong>${input.orderNumber}</strong> has been placed successfully.</p>
     <p>${input.itemsSummary}</p>
     <p>Order total: <strong>${input.total}</strong></p>
     ${input.eta ? `<p>Estimated delivery: <strong>${input.eta}</strong></p>` : ""}
     <p>You can track the order status in the app at any time.</p>`
  );
  const text = `Order ${input.orderNumber} confirmed.\n${input.itemsSummary}\nOrder total: ${input.total}${input.eta ? `\nEstimated delivery: ${input.eta}` : ""}`;
  return { subject, html, text };
}

export function paymentSuccessTemplate(input: {
  name: string;
  orderNumber: string;
  amount: string;
  paymentId?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `Payment received for order ${input.orderNumber}`;
  const html = layout(
    subject,
    `<h2>Payment successful 💳</h2>
     <p>Hi ${input.name}, we've received your payment of <strong>${input.amount}</strong> for order <strong>${input.orderNumber}</strong>.</p>
     ${input.paymentId ? `<p>Payment reference: ${input.paymentId}</p>` : ""}
     <p>Thank you for shopping with us!</p>`
  );
  const text = `Payment of ${input.amount} received for order ${input.orderNumber}.${input.paymentId ? ` Reference: ${input.paymentId}` : ""}`;
  return { subject, html, text };
}

export function vendorApprovedTemplate(input: {
  name: string;
  businessName: string;
}): { subject: string; html: string; text: string } {
  const subject = `${input.businessName} is approved!`;
  const html = layout(
    subject,
    `<h2>You're approved! 🎊</h2>
     <p>Hi ${input.name}, great news — your vendor profile <strong>${input.businessName}</strong> has been approved.</p>
     <p>Set your business hours, update your location and start accepting orders today.</p>`
  );
  const text = `${input.businessName} has been approved. Set your hours and start accepting orders!`;
  return { subject, html, text };
}

export function vendorRejectedTemplate(input: {
  name: string;
  businessName: string;
  reason: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `Update on ${input.businessName} application`;
  const html = layout(
    subject,
    `<h2>Application update</h2>
     <p>Hi ${input.name}, we're sorry to share that your vendor application <strong>${input.businessName}</strong> was not approved at this time.</p>
     ${input.reason ? `<p>Reason: ${input.reason}</p>` : ""}
     <p>You may update your details and re-apply.</p>`
  );
  const text = `${input.businessName} was not approved.${input.reason ? ` Reason: ${input.reason}` : ""}`;
  return { subject, html, text };
}
