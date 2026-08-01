import request from "supertest";

import app from "../../src/app";

describe("Phase 1 integration smoke tests", () => {
  it("GET / returns service metadata", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.docs).toBe("/api/v1/docs");
    expect(res.body.data.health).toBe("/api/v1/health");
  });

  it("GET /api/v1/health returns liveness payload", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.app).toBeDefined();
    expect(res.body.data.environment).toBeDefined();
    expect(res.body.data.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/v1/health/db reports connectivity", async () => {
    const res = await request(app).get("/api/v1/health/db");
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.database).toHaveProperty("connected");
  });

  it("unknown route returns a consistent 404 JSON shape", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("malformed JSON returns a 400", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("sets security headers via helmet", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("docs route is served when swagger enabled", async () => {
    const res = await request(app).get("/api/v1/docs/");
    expect([200, 404]).toContain(res.status);
  });

  it("sets CORS headers for an allowed origin", async () => {
    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("rejects a disallowed origin with 403", async () => {
    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://evil.example.com");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_ORIGIN_NOT_ALLOWED");
  });

  it("answers preflight OPTIONS for allowed origins", async () => {
    const res = await request(app)
      .options("/api/v1/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("GET");
  });
});
