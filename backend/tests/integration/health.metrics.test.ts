import request from "supertest";

import app from "../../src/app";

describe("Phase 7 health & monitoring endpoints", () => {
  it("GET /api/v1/health/system returns system metrics", async () => {
    const res = await request(app).get("/api/v1/health/system");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.system).toBeDefined();
    expect(res.body.data.system.memory_usage_mb).toBeGreaterThan(0);
    expect(res.body.data.system.cpu).toBeDefined();
  });

  it("GET /api/v1/health/redis reports status", async () => {
    const res = await request(app).get("/api/v1/health/redis");
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.redis).toBeDefined();
    expect(res.body.data.redis).toHaveProperty("status");
  });

  it("GET /api/v1/health/storage reports configuration", async () => {
    const res = await request(app).get("/api/v1/health/storage");
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.storage).toHaveProperty("status");
    expect(res.body.data.storage).toHaveProperty("details");
  });

  it("GET /api/v1/health/payment reports configuration", async () => {
    const res = await request(app).get("/api/v1/health/payment");
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.payment).toHaveProperty("status");
  });

  it("GET /api/v1/health/email reports configuration", async () => {
    const res = await request(app).get("/api/v1/health/email");
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.email).toHaveProperty("status");
  });

  it("GET /api/v1/health/all aggregates every subsystem", async () => {
    const res = await request(app).get("/api/v1/health/all");
    expect([200, 503]).toContain(res.status);
    for (const key of ["database", "redis", "storage", "payment", "email", "system"]) {
      expect(res.body.data).toHaveProperty(key);
    }
    expect(res.body.data).toHaveProperty("cache_available");
  });

  it("GET /api/v1/health/database is an alias of /health/db", async () => {
    const res = await request(app).get("/api/v1/health/database");
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.database).toHaveProperty("connected");
  });

  it("GET /api/v1/metrics returns a metrics snapshot", async () => {
    const res = await request(app).get("/api/v1/metrics");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requests).toBeDefined();
    expect(res.body.data.cache).toHaveProperty("hit_rate");
    expect(res.body.data.system).toBeDefined();
  });

  it("v2 mounts mirror v1 health endpoints", async () => {
    const res = await request(app).get("/api/v2/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers["api-version"]).toBe("v2");
  });

  it("v1 responses echo the API-Version header", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.headers["api-version"]).toBe("v1");
  });

  it("unknown api version falls through to the root handler", async () => {
    const res = await request(app).get("/api/v9/health");
    expect([200, 404]).toContain(res.status);
  });
});
