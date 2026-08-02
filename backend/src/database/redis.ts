import Redis from "ioredis";

import { env } from "../config";
import log from "../config/logger";

interface CustomRedis extends Redis {
  healthy?: boolean;
  lastErrorAt?: number;
}

const globalForRedis = globalThis as unknown as {
  redis: CustomRedis | undefined;
};

function createRedisClient(): CustomRedis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  const client = new Redis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    connectTimeout: 3000,
    lazyConnect: false,
    retryStrategy: (times: number) => Math.min(times * 100, 1000),
  }) as CustomRedis;

  client.healthy = true;

  client.on("ready", () => {
    client.healthy = true;
    log.info("Redis connection established", { context: "redis" });
  });

  client.on("error", (error) => {
    client.healthy = false;
    client.lastErrorAt = Date.now();
    log.error("Redis connection error", { context: "redis", error: error.message });
  });

  client.on("close", () => {
    client.healthy = false;
    log.warn("Redis connection closed", { context: "redis" });
  });

  client.on("end", () => {
    client.healthy = false;
    log.warn("Redis connection ended", { context: "redis" });
  });

  return client;
}

export const redis: CustomRedis | null = globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis ?? undefined;
}

export function isRedisAvailable(): boolean {
  if (!redis) return false;
  return redis.status === "ready" || redis.status === "connecting" || redis.healthy === true;
}

export function buildKey(...parts: Array<string | number>): string {
  return [env.REDIS_PREFIX, ...parts].join(":");
}

export async function pingRedis(): Promise<{ connected: boolean; latencyMs: number }> {
  if (!redis) {
    return { connected: false, latencyMs: 0 };
  }
  const startedAt = Date.now();
  try {
    const pong = await redis.ping();
    return { connected: pong === "PONG", latencyMs: Date.now() - startedAt };
  } catch (error) {
    log.warn("Redis ping failed", { context: "redis", error: error instanceof Error ? error.message : String(error) });
    return { connected: false, latencyMs: Date.now() - startedAt };
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch (error) {
      log.warn("Error disconnecting redis", { context: "redis", error: error instanceof Error ? error.message : String(error) });
    }
  }
}
