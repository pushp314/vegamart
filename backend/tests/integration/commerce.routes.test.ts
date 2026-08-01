import request from "supertest";

import app from "../../src/app";

describe("Phase 4 commerce routes (validation & authorization, no DB)", () => {
  it("requires auth to read the cart", async () => {
    const res = await request(app).get("/api/v1/cart");
    expect(res.status).toBe(401);
  });

  it("requires auth to add to the cart", async () => {
    const res = await request(app).post("/api/v1/cart/items").send({ product_id: "11111111-1111-1111-1111-111111111111", quantity: 1 });
    expect(res.status).toBe(401);
  });

  it("rejects a cart item with a non-uuid product id as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: "nope", quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a cart item with quantity 0 as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: "11111111-1111-1111-1111-111111111111", quantity: 0 });
    expect(res.status).toBe(422);
  });

  it("requires auth to read the wishlist", async () => {
    const res = await request(app).get("/api/v1/wishlist");
    expect(res.status).toBe(401);
  });

  it("requires auth to validate a coupon", async () => {
    const res = await request(app).post("/api/v1/coupons/validate").send({ code: "SAVE10" });
    expect(res.status).toBe(401);
  });

  it("requires auth to create a coupon", async () => {
    const res = await request(app).post("/api/v1/coupons").send({ code: "SAVE10", type: "PERCENTAGE", value: 10 });
    expect(res.status).toBe(401);
  });

  it("requires auth to preview checkout", async () => {
    const res = await request(app).post("/api/v1/checkout/preview").send({});
    expect(res.status).toBe(401);
  });

  it("requires auth to place an order", async () => {
    const res = await request(app).post("/api/v1/checkout").send({ address_id: "11111111-1111-1111-1111-111111111111" });
    expect(res.status).toBe(401);
  });

  it("rejects checkout with an invalid address uuid as 422", async () => {
    const guest = await request(app).post("/api/v1/auth/guest");
    const token = guest.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ address_id: "nope" });
    expect(res.status).toBe(422);
  });

  it("requires auth to verify a payment", async () => {
    const res = await request(app).post("/api/v1/payments/verify").send({ razorpay_order_id: "x", razorpay_payment_id: "y", razorpay_signature: "z" });
    expect(res.status).toBe(401);
  });

  it("requires auth to read orders", async () => {
    const res = await request(app).get("/api/v1/orders");
    expect(res.status).toBe(401);
  });

  it("requires auth to read vendor orders", async () => {
    const res = await request(app).get("/api/v1/vendors/orders");
    expect(res.status).toBe(401);
  });
});
