import nodemailer, { Transporter } from "nodemailer";

import { env } from "../config";
import log from "../config/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;

export function isEmailEnabled(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER);
}

function getTransporter(): Transporter | null {
  if (!isEmailEnabled()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      from: env.SMTP_FROM,
    });
  }
  return transporter;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      log.info(
        `[mailer] SMTP disabled / unconfigured (Optional in dev). Email to <${message.to}> omitted.\n` +
          `Preview Link / Code:\n${message.text ?? message.html}`
      );
    }
    return false;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    log.info(`[mailer] Email sent to ${message.to}`, { context: "email", subject: message.subject });
    return true;
  } catch (error) {
    log.error(`[mailer] Failed to send email to ${message.to}`, {
      context: "email",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    return false;
  }
}
