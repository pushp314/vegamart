import crypto from "crypto";
import { redis, isRedisAvailable } from "../database/redis";
import { memoryCacheGet, memoryCacheSet, memoryCacheDel } from "../database/cache-memory";
import log from "../config/logger";
import type { JwtAccessPayload } from "../types";

const TICKET_PREFIX = "vegamart:ws_ticket:";
const TICKET_TTL_SECONDS = 30;

export async function createRealtimeTicket(user: { id: string; role: string; email?: string }): Promise<string> {
  const ticket = crypto.randomBytes(24).toString("hex");
  const key = `${TICKET_PREFIX}${ticket}`;
  const payload: JwtAccessPayload = {
    sub: user.id,
    email: user.email || "",
    role: user.role as any,
    type: "access",
  };
  const serialized = JSON.stringify(payload);

  if (isRedisAvailable() && redis) {
    try {
      await redis.set(key, serialized, "EX", TICKET_TTL_SECONDS);
      return ticket;
    } catch (err) {
      log.warn("Redis unavailable while saving realtime ticket, falling back to memory cache", {
        context: "realtime-ticket",
        error: (err as Error).message,
      });
    }
  }

  memoryCacheSet(key, serialized, TICKET_TTL_SECONDS);
  return ticket;
}

export async function consumeRealtimeTicket(ticket: string): Promise<JwtAccessPayload | null> {
  if (!ticket || typeof ticket !== "string" || ticket.length < 16) {
    return null;
  }
  const key = `${TICKET_PREFIX}${ticket}`;

  if (isRedisAvailable() && redis) {
    try {
      const data = await redis.get(key);
      if (data) {
        await redis.del(key);
        return JSON.parse(data) as JwtAccessPayload;
      }
    } catch (err) {
      log.warn("Redis error while consuming realtime ticket, falling back to memory cache", {
        context: "realtime-ticket",
        error: (err as Error).message,
      });
    }
  }

  const memoryData = memoryCacheGet(key);
  if (memoryData) {
    memoryCacheDel(key);
    try {
      return JSON.parse(memoryData) as JwtAccessPayload;
    } catch {
      return null;
    }
  }

  return null;
}
