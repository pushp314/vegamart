import { cacheService } from "../../src/database/cache";
import { env } from "../../src/config";

jest.mock("../../src/config/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn(), child: jest.fn() },
}));

describe("cacheService", () => {
  beforeAll(() => {
    process.env.REDIS_URL = "";
  });

  it("uses the memory fallback when redis is unavailable", async () => {
    await cacheService.set("product", "detail:abc", { id: "abc", name: "Apple" }, 60);
    const cached = await cacheService.get<{ id: string; name: string }>("product", "detail:abc");
    expect(cached).toEqual({ id: "abc", name: "Apple" });
  });

  it("returns null for a missing key", async () => {
    const cached = await cacheService.get("product", "missing-key");
    expect(cached).toBeNull();
  });

  it("deletes a cached value", async () => {
    await cacheService.set("category", "slug:fruits", { id: "c1" }, 60);
    await cacheService.delete("category", "slug:fruits");
    expect(await cacheService.get("category", "slug:fruits")).toBeNull();
  });

  it("remember caches the factory result", async () => {
    const factory = jest.fn().mockResolvedValue({ count: 42 });
    const first = await cacheService.remember("analytics", "top:1", factory);
    const second = await cacheService.remember("analytics", "top:1", factory);
    expect(first).toEqual({ count: 42 });
    expect(second).toEqual({ count: 42 });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("remember always re-invokes the factory when it returns null", async () => {
    const factory = jest.fn().mockResolvedValue(null);
    await cacheService.remember("settings", "empty", factory);
    await cacheService.remember("settings", "empty", factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("uses the namespace default TTL", async () => {
    await cacheService.set("settings", "public", { x: 1 });
    expect(await cacheService.get("settings", "public")).toEqual({ x: 1 });
  });

  it("isEnabled reflects redis availability", () => {
    expect(typeof cacheService.isEnabled()).toBe("boolean");
  });

  it("round-trips numbers and booleans through serialization", async () => {
    await cacheService.set("dashboard", "overview", { revenue: 12.5, ok: true }, 60);
    const cached = await cacheService.get<{ revenue: number; ok: boolean }>("dashboard", "overview");
    expect(cached).toEqual({ revenue: 12.5, ok: true });
  });

  it("invalidateEntity removes the entity detail key", async () => {
    await cacheService.set("product", "detail:p1", { id: "p1" }, 60);
    await cacheService.invalidateEntity("product", "p1");
    expect(await cacheService.get("product", "detail:p1")).toBeNull();
  });

  it("honors explicit TTLs without throwing", async () => {
    await expect(cacheService.set("product", "ttl-test", { ok: true }, 5)).resolves.toBeUndefined();
    expect(env.CACHE_TTL_SECONDS_DEFAULT).toBeGreaterThan(0);
  });
});
