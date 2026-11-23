import prisma from "./prisma";
import log from "../config/logger";

export interface DbStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

export async function pingDatabase(): Promise<DbStatus> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { connected: false, latencyMs: Date.now() - startedAt, error: message };
  }
}

export async function connectDatabase(retries = 3, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$connect();
      log.info(`Connected to PostgreSQL (attempt ${attempt})`);

      // Idempotently ensure columns added in recent features exist on production schema
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "map_url" VARCHAR(500);
          ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "exact_location" VARCHAR(500);
        `);
      } catch (colErr) {
        log.warn("Database column ensure check skipped:", { error: String(colErr) });
      }

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Database connection attempt ${attempt}/${retries} failed: ${message}`);
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
