import request from "supertest";

import app from "../../src/app";

describe("Phase 3 marketplace routes (validation & authorization)", () => {
  it("requires auth to create a category", async () => {
    const res = await request(app)
      .post("/api/v1/categories")
      .send({ name: "Vegetables" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("requires auth to update a category", async () => {
    const res = await request(app)
      .patch("/api/v1/categories/11111111-1111-1111-1111-111111111111")
      .send({ name: "Fruits" });
    expect(res.status).toBe(401);
  });

  it("requires auth to register a vendor", async () => {
    const res = await request(app).post("/api/v1/vendors").send({
      business_name: "Sharma Store",
      address: "Main Road",
      city: "Delhi",
      state: "DL",
      pincode: "110001",
    });
    expect(res.status).toBe(401);
  });

  it("requires auth to read own vendor profile", async () => {
    const res = await request(app).get("/api/v1/vendors/me");
    expect(res.status).toBe(401);
  });

  it("requires auth to toggle vendor availability", async () => {
    const res = await request(app)
      .put("/api/v1/vendors/me/availability")
      .send({ is_open: true });
    expect(res.status).toBe(401);
  });

  it("requires auth to update vendor location", async () => {
    const res = await request(app)
      .put("/api/v1/vendors/me/location")
      .send({ lat: 28.6, lng: 77.2 });
    expect(res.status).toBe(401);
  });

  it("requires auth to create a product", async () => {
    const res = await request(app).post("/api/v1/products").send({});
    expect(res.status).toBe(401);
  });

  it("requires auth to list own products", async () => {
    const res = await request(app).get("/api/v1/products/me");
    expect(res.status).toBe(401);
  });

  it("requires auth to touch inventory", async () => {
    const res = await request(app)
      .put("/api/v1/inventory/11111111-1111-1111-1111-111111111111")
      .send({ quantity: 5 });
    expect(res.status).toBe(401);
  });

  it("rejects nearby vendors without coordinates", async () => {
    const res = await request(app).get("/api/v1/vendors/nearby");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects nearby vendors with invalid latitude", async () => {
    const res = await request(app).get("/api/v1/vendors/nearby?lat=999&lng=77");
    expect(res.status).toBe(422);
  });

  it("rejects products with per_page over the max", async () => {
    const res = await request(app).get("/api/v1/products?per_page=500");
    expect(res.status).toBe(422);
  });

  it("rejects search without a query", async () => {
    const res = await request(app).get("/api/v1/search");
    expect(res.status).toBe(422);
  });

  it("rejects category id that is not a uuid", async () => {
    const res = await request(app).get("/api/v1/categories/not-a-uuid");
    expect(res.status).toBe(422);
  });

  it("rejects an invalid bulk inventory payload", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .put("/api/v1/inventory/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product_id: "nope", quantity: -1 }] });
    expect(res.status).toBe(422);
  });

  it("admin review route requires auth", async () => {
    const res = await request(app)
      .post("/api/v1/vendors/11111111-1111-1111-1111-111111111111/review")
      .send({ decision: "approve" });
    expect(res.status).toBe(401);
  });

  it("contact form requires auth", async () => {
    const res = await request(app)
      .post("/api/v1/contact")
      .send({ name: "Test", email: "test@example.com", message: "Hello" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("contact form validates the message field", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test", email: "test@example.com" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("product review requires auth", async () => {
    const res = await request(app)
      .post("/api/v1/products/11111111-1111-1111-1111-111111111111/reviews")
      .send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it("product review requires a valid rating", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/products/11111111-1111-1111-1111-111111111111/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ rating: 9 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
