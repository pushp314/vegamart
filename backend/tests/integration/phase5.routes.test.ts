import request from "supertest";

import app from "../../src/app";

describe("Phase 5 routes (validation & authorization, no DB)", () => {
  it("requires auth to patch vendor location", async () => {
    const res = await request(app).patch("/api/v1/vendors/location").send({ latitude: 28.6, longitude: 77.2 });
    expect(res.status).toBe(401);
  });

  it("requires auth to read own vendor location", async () => {
    const res = await request(app).get("/api/v1/vendors/location");
    expect(res.status).toBe(401);
  });

  it("rejects vendor location with an out-of-range latitude as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .patch("/api/v1/vendors/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 95, longitude: 77.2 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a malformed nearby products query as 422", async () => {
    const res = await request(app).get("/api/v1/search/nearby-products?lat=abc&lng=77.2");
    expect(res.status).toBe(422);
  });

  it("rejects a nearby products query with an out-of-range radius as 422", async () => {
    const res = await request(app).get("/api/v1/search/nearby-products?lat=28.6&lng=77.2&radius=999");
    expect(res.status).toBe(422);
  });

  it("requires auth to upload an image", async () => {
    const res = await request(app).post("/api/v1/upload/image").attach("file", Buffer.from("nope"), "x.png").field("folder", "products");
    expect(res.status).toBe(401);
  });

  it("rejects an image upload with an invalid folder as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/upload/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "x.png")
      .field("folder", "hack");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires auth to delete an uploaded image", async () => {
    const res = await request(app).delete("/api/v1/upload/image").send({ key: "products/abc.png" });
    expect(res.status).toBe(401);
  });

  it("requires auth to list notifications", async () => {
    const res = await request(app).get("/api/v1/notifications");
    expect(res.status).toBe(401);
  });

  it("requires auth to read the unread notification count", async () => {
    const res = await request(app).get("/api/v1/notifications/unread-count");
    expect(res.status).toBe(401);
  });

  it("requires auth to delete a notification", async () => {
    const res = await request(app).delete("/api/v1/notifications/11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(401);
  });

  it("rejects a notification delete with a non-uuid id as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .delete("/api/v1/notifications/nope")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(422);
  });

  it("rejects a notification list with an invalid type filter as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .get("/api/v1/notifications?type=nope")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(422);
  });
});
