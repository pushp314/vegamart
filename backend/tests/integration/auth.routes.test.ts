import request from "supertest";

import app from "../../src/app";

describe("Phase 2 auth routes (no DB required)", () => {
  it("rejects register with invalid input as 422", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "weak",
    });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects login with invalid input as 422", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "x" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects refresh with an empty token as 401", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects otp verify with a non-numeric otp as 422", async () => {
    const res = await request(app).post("/api/v1/auth/otp/verify").send({
      identifier: "a@b.com",
      purpose: "LOGIN",
      otp: "abcd",
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a guest session without a database", async () => {
    const res = await request(app).post("/api/v1/auth/guest");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.role).toBe("customer");
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(Array.isArray(setCookie)).toBe(true);
  });

  it("protects /users/me with authentication", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("protects /users/me/sessions with authentication", async () => {
    const res = await request(app).get("/api/v1/users/me/sessions");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid access token on a protected route", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("still 404s unknown /api/v1 routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
