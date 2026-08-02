import request from "supertest";

import app from "../../src/app";

type Method = "get" | "post" | "put" | "delete";
interface EndpointCase {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
}

function call(agent: ReturnType<typeof request>, method: Method, path: string, body?: Record<string, unknown>) {
  if (method === "get") return agent.get(path);
  if (method === "post") return agent.post(path).send(body ?? {});
  if (method === "put") return agent.put(path).send(body ?? {});
  return agent.delete(path);
}

const AUTH_REQUIRED_ENDPOINTS: EndpointCase[] = [
  { method: "get", path: "/api/v1/users/me/addresses" },
  { method: "post", path: "/api/v1/users/me/addresses", body: { label: "Home", full_address: "1 Main Rd", city: "City", state: "ST", pincode: "560001" } },
  { method: "put", path: "/api/v1/users/me/addresses/11111111-1111-1111-1111-111111111111", body: { label: "Work" } },
  { method: "delete", path: "/api/v1/users/me/addresses/11111111-1111-1111-1111-111111111111" },
  { method: "put", path: "/api/v1/users/me/addresses/11111111-1111-1111-1111-111111111111/default" },
  { method: "get", path: "/api/v1/users/me/recently-viewed" },
  { method: "post", path: "/api/v1/users/me/recently-viewed", body: { product_id: "11111111-1111-1111-1111-111111111111" } },
  { method: "get", path: "/api/v1/users/me/recommended" },
  { method: "post", path: "/api/v1/checkout/create-order", body: { address_id: "11111111-1111-1111-1111-111111111111", payment_method: "upi" } },
  { method: "get", path: "/api/v1/orders/vendor" },
  { method: "post", path: "/api/v1/orders/11111111-1111-1111-1111-111111111111/reorder", body: {} },
  { method: "post", path: "/api/v1/orders/11111111-1111-1111-1111-111111111111/return", body: {} },
  { method: "post", path: "/api/v1/vendors/register", body: { business_name: "Test Store", address: "Main Road", city: "Delhi", state: "DL", pincode: "110001" } },
  { method: "put", path: "/api/v1/vendors/me/availability", body: { is_open: true } },
  { method: "put", path: "/api/v1/vendors/me/toggle-availability", body: { is_open: true } },
  { method: "put", path: "/api/v1/vendors/me/profile", body: { description: "Fresh" } },
  { method: "get", path: "/api/v1/vendors/me/kyc" },
  { method: "post", path: "/api/v1/vendors/me/kyc", body: { document_type: "Aadhaar", document_number: "123456789012" } },
  { method: "get", path: "/api/v1/vendors/me/earnings" },
  { method: "post", path: "/api/v1/vendors/11111111-1111-1111-1111-111111111111/ring-bell", body: { address: "4th Cross, Main Rd" } },
  { method: "post", path: "/api/v1/delivery/register", body: { vehicle_type: "Bike", vehicle_number: "KA01AB1234" } },
  { method: "get", path: "/api/v1/delivery/me" },
  { method: "get", path: "/api/v1/delivery/requests" },
  { method: "get", path: "/api/v1/delivery/my-deliveries" },
  { method: "put", path: "/api/v1/delivery/orders/11111111-1111-1111-1111-111111111111/accept" },
  { method: "put", path: "/api/v1/delivery/orders/11111111-1111-1111-1111-111111111111/status", body: { status: "picked_up" } },
  { method: "put", path: "/api/v1/delivery/location", body: { lat: 12.9, lng: 77.6 } },
  { method: "put", path: "/api/v1/delivery/order/11111111-1111-1111-1111-111111111111/delivered", body: { otp: "123456" } },
  { method: "post", path: "/api/v1/delivery/me/kyc", body: { aadhaar_number: "123456789012" } },
  { method: "get", path: "/api/v1/delivery/order/11111111-1111-1111-1111-111111111111/tracking" },
];

const ADMIN_REQUIRED_ENDPOINTS: EndpointCase[] = [
  { method: "get", path: "/api/v1/admin/delivery" },
  { method: "put", path: "/api/v1/admin/vendors/11111111-1111-1111-1111-111111111111/approve" },
  { method: "put", path: "/api/v1/admin/vendors/11111111-1111-1111-1111-111111111111/reject", body: { reason: "Bad docs" } },
  { method: "put", path: "/api/v1/admin/users/11111111-1111-1111-1111-111111111111/status", body: { is_active: false } },
  { method: "put", path: "/api/v1/admin/delivery/11111111-1111-1111-1111-111111111111/approve" },
  { method: "put", path: "/api/v1/admin/delivery/11111111-1111-1111-1111-111111111111/reject" },
];

describe("Integration compatibility routes", () => {
  describe("protected endpoints require authentication", () => {
    it.each(AUTH_REQUIRED_ENDPOINTS)("$method $path returns 401 without a token", async ({ method, path, body }) => {
      const res = await call(request(app), method, path, body);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("admin alias routes require authentication", () => {
    it.each(ADMIN_REQUIRED_ENDPOINTS)("$method $path returns 401 without a token", async ({ method, path, body }) => {
      const res = await call(request(app), method, path, body);
      expect(res.status).toBe(401);
    });
  });

  describe("public browse endpoints", () => {
    it.each(["/api/v1/banners", "/api/v1/offers", "/api/v1/faqs", "/api/v1/products/trending"])(
      "GET %s responds (200 or 503 depending on DB)",
      async (path) => {
        const res = await request(app).get(path);
        expect([200, 503]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      }
    );
  });

  describe("ring-bell vendor id validation", () => {
    it("rejects a non-UUID vendor id with 401 when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/not-a-uuid/ring-bell")
        .send({ address: "4th Cross" });
      expect(res.status).toBe(401);
    });
  });
});
