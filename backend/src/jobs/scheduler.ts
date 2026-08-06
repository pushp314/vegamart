import cron, { ScheduledTask } from "node-cron";

import { env } from "../config";
import log from "../config/logger";
import {
  cleanupExpiredOtps,
  cleanupExpiredRefreshTokens,
  cleanupExpiredTokens,
  cleanupOldNotifications,
  cleanupTempFiles,
  computeDailySalesReport,
  computeDailyVendorSummaries,
  expireExpiredCoupons,
  expireExpiredMemberships,
  remindExpiringMemberships,
} from "./job-tasks";

interface RegisteredJob {
  name: string;
  task: ScheduledTask | null;
}

const jobs: RegisteredJob[] = [];

function register(name: string, expression: string, fn: () => Promise<unknown>): void {
  const isValid = cron.validate(expression);
  if (!isValid) {
    log.warn(`[cron] Invalid schedule "${expression}" for job "${name}" — skipped.`, { context: "cron" });
    return;
  }
  const task = cron.schedule(
    expression,
    async () => {
      try {
        await fn();
      } catch (error) {
        log.error(`[cron] Job "${name}" failed`, {
          context: "cron",
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        });
      }
    },
    { timezone: "Asia/Kolkata" }
  );
  jobs.push({ name, task });
  log.info(`[cron] Registered job "${name}" (${expression})`, { context: "cron" });
}

export function startJobs(): void {
  if (!env.CRON_ENABLED) {
    log.info("[cron] Background jobs disabled (CRON_ENABLED=false).", { context: "cron" });
    return;
  }

  // Every 15 minutes: purge expired OTPs and password reset tokens
  register("cleanup-expired-otps", "*/15 * * * *", () => cleanupExpiredOtps());
  register("cleanup-expired-tokens", "*/15 * * * *", () => cleanupExpiredTokens());

  // Hourly: purge expired refresh tokens
  register("cleanup-expired-refresh-tokens", "0 * * * *", () => cleanupExpiredRefreshTokens());

  // Daily at 03:00 IST: expire coupons that have lapsed
  register("expire-expired-coupons", "0 3 * * *", () => expireExpiredCoupons());

  // Hourly: demote vendors whose paid membership has lapsed
  register("expire-expired-memberships", "15 * * * *", () => expireExpiredMemberships());

  // Daily at 08:00 IST: remind vendors whose membership expires in 7 or 1 days
  register("remind-expiring-memberships", "0 8 * * *", () => remindExpiringMemberships());

  // Daily at 04:00 IST: clean up old notifications
  register("cleanup-old-notifications", "0 4 * * *", () =>
    cleanupOldNotifications(env.NOTIFICATION_RETENTION_DAYS)
  );

  // Daily at 05:00 IST: flag temp files for cleanup
  register("cleanup-temp-files", "0 5 * * *", () =>
    cleanupTempFiles(env.TEMP_FILE_RETENTION_HOURS)
  );

  // Daily at 23:30 IST: daily sales report + vendor summaries (for yesterday)
  register("daily-sales-report", "30 23 * * *", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await computeDailySalesReport(yesterday);
    await computeDailyVendorSummaries(yesterday);
  });
}

export function stopJobs(): void {
  for (const job of jobs) {
    job.task?.stop();
  }
  jobs.length = 0;
}
