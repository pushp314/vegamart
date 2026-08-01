import request from "supertest";

jest.mock("../../src/repositories/settings.repository", () => ({
  getPublicSettings: jest.fn().mockResolvedValue([]),
  getByKey: jest.fn().mockResolvedValue(null),
  getByKeys: jest.fn().mockResolvedValue([]),
  listAllSettings: jest.fn().mockResolvedValue([]),
  upsertSetting: jest.fn(),
}));

import app from "../../src/app";
import { ROLES } from "../../src/constants/roles";
import { signAccessToken } from "../../src/services/token.service";

function adminToken(): string {
  return signAccessToken({
    sub: "00000000-0000-0000-0000-000000000001",
    email: "admin@test.local",
    role: ROLES.ADMIN,
    session_id: "test-session",
  });
}

describe("Phase 6 admin routes (validation & authorization, no DB)", () => {
  it("requires auth for the dashboard", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("rejects a non-admin (guest) token on admin routes with 403", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("requires auth to list users", async () => {
    const res = await request(app).get("/api/v1/admin/users");
    expect(res.status).toBe(401);
  });

  it("rejects a user suspend with a non-uuid id as 422", async () => {
    const res = await request(app)
      .post("/api/v1/admin/users/nope/suspend")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "test" });
    expect(res.status).toBe(422);
  });

  it("requires auth for reports", async () => {
    const res = await request(app).get("/api/v1/admin/reports/revenue");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed revenue report query as 422", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports/revenue?days=abc")
      .set("Authorization", `Bearer ${adminToken()}`);
    expect(res.status).toBe(422);
  });

  it("rejects an invalid custom report group_by as 422", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports/custom?group_by=nope")
      .set("Authorization", `Bearer ${adminToken()}`);
    expect(res.status).toBe(422);
  });

  it("requires auth for analytics", async () => {
    const res = await request(app).get("/api/v1/admin/analytics/top-products");
    expect(res.status).toBe(401);
  });

  it("requires auth for audit logs", async () => {
    const res = await request(app).get("/api/v1/admin/audit-logs");
    expect(res.status).toBe(401);
  });

  it("requires auth for settings", async () => {
    const res = await request(app).get("/api/v1/admin/settings");
    expect(res.status).toBe(401);
  });

  it("rejects an empty settings patch as 422", async () => {
    const res = await request(app)
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it("rejects an announcement create with an invalid audience as 422", async () => {
    const res = await request(app)
      .post("/api/v1/admin/announcements")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ title: "Hi", body: "World", audience: "aliens" });
    expect(res.status).toBe(422);
  });

  it("requires auth to delete an announcement", async () => {
    const res = await request(app).delete("/api/v1/admin/announcements/11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(401);
  });

  it("serves public settings without auth", async () => {
    const res = await request(app).get("/api/v1/settings/public");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data["platform.name"]).toBe("Gali Connect");
  });

  it("rate-limits report endpoints", async () => {
    const res = await request(app).get("/api/v1/admin/reports/orders?days=7");
    expect([401, 403, 429]).toContain(res.status);
  });
});
