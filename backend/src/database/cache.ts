import { env } from "../config";
import log from "../config/logger";
import { buildKey, isRedisAvailable, redis } from "../database/redis";
import * as mem from "../database/cache-memory";
import { recordCacheAccess } from "../monitoring/metrics";

const TTL_VARIANTS: Record<string, number> = {
  product: env.CACHE_TTL_PRODUCT,
  vendor: env.CACHE_TTL_VENDOR,
  category: env.CACHE_TTL_CATEGORY,
  settings: env.CACHE_TTL_SETTINGS,
  dashboard: env.CACHE_TTL_DASHBOARD,
  analytics: env.CACHE_TTL_ANALYTICS,
};

function resolveTtl(namespace: string, ttlSeconds?: number): number {
  if (ttlSeconds !== undefined && ttlSeconds > 0) {
    return ttlSeconds;
  }
  return TTL_VARIANTS[namespace] ?? env.CACHE_TTL_SECONDS_DEFAULT;
}

function serialize(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function deserialize<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    log.warn("Cache deserialization failed", { context: "cache", error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function memorySet(key: string, value: string, ttlSeconds: number): Promise<void> {
  mem.memoryCacheSet(key, value, ttlSeconds);
}

async function memoryGet(key: string): Promise<string | null> {
  return mem.memoryCacheGet(key);
}

async function memoryDel(key: string): Promise<void> {
  mem.memoryCacheDel(key);
}

export const cacheService = {
  isEnabled(): boolean {
    return isRedisAvailable();
  },

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = buildKey(namespace, key);
    if (isRedisAvailable() && redis) {
      try {
        const raw = await redis.get(fullKey);
        recordCacheAccess(raw !== null);
        return deserialize<T>(raw);
      } catch (error) {
        log.warn("Cache get failed, falling back to memory", { context: "cache", error: error instanceof Error ? error.message : String(error) });
        recordCacheAccess(false, true);
      }
    }
    const raw = await memoryGet(fullKey);
    recordCacheAccess(raw !== null);
    return deserialize<T>(raw);
  },

  async set(namespace: string, key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const fullKey = buildKey(namespace, key);
    const ttl = resolveTtl(namespace, ttlSeconds);
    const raw = serialize(value);
    if (isRedisAvailable() && redis) {
      try {
        await redis.set(fullKey, raw, "EX", ttl);
        return;
      } catch (error) {
        log.warn("Cache set failed, falling back to memory", { context: "cache", error: error instanceof Error ? error.message : String(error) });
      }
    }
    await memorySet(fullKey, raw, ttl);
  },

  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = buildKey(namespace, key);
    if (isRedisAvailable() && redis) {
      try {
        await redis.del(fullKey);
      } catch (error) {
        log.warn("Cache delete failed", { context: "cache", error: error instanceof Error ? error.message : String(error) });
      }
    }
    await memoryDel(fullKey);
  },

  async invalidateNamespace(namespace: string): Promise<void> {
    const pattern = buildKey(namespace, "*");
    if (isRedisAvailable() && redis) {
      try {
        await new Promise<void>((resolve, reject) => {
          const stream = redis!.scanStream({ match: pattern, count: 100 });
          const keys: string[] = [];
          
          stream.on("data", (resultKeys: string[]) => {
            keys.push(...resultKeys);
          });
          
          stream.on("end", async () => {
            if (keys.length > 0) {
              try {
                await redis!.del(...keys);
              } catch (err) {
                log.warn("Cache namespace invalidation failed during del", { context: "cache", error: err instanceof Error ? err.message : String(err) });
              }
            }
            resolve();
          });
          
          stream.on("error", (err) => {
            reject(err);
          });
        });
      } catch (error) {
        log.warn("Cache namespace invalidation failed", { context: "cache", error: error instanceof Error ? error.message : String(error) });
      }
    }
    mem.memoryCacheClearPattern(pattern);
  },

  async invalidateEntity(entity: string, id: string): Promise<void> {
    await this.delete(entity, `detail:${id}`);
    if (entity === "product") {
      await this.delete("product", `byVendor:${id}`);
    }
  },

  /**
   * Get a cached value or compute and cache it (cache-aside with fallback).
   * If the backing store is unavailable the factory is always invoked.
   */
  async remember<T>(namespace: string, key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    if (value !== null && value !== undefined) {
      await this.set(namespace, key, value, ttlSeconds);
    }
    return value;
  },
};
