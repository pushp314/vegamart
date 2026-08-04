import type { Request, Response } from "express";
import { ipAbuseGuard, periodicAbuseCleanup, securityHeaders } from "../../src/middlewares/security";

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    status: jest.fn(function (this: unknown) {
      return this;
    }),
    json: jest.fn(),
    setHeader: jest.fn((name: string, value: string) => {
      headers[String(name).toLowerCase()] = value;
    }),
    removeHeader: jest.fn((name: string) => {
      delete headers[String(name).toLowerCase()];
    }),
    getHeader: (name: string) => headers[String(name).toLowerCase()],
  } as unknown as Response;
  return res;
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    ip: "10.0.0.1",
    headers: {},
    requestId: "req-1",
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

jest.mock("../../src/monitoring/security-events", () => ({
  securityEventFromReq: jest.fn(),
}));

describe("security middleware", () => {
  describe("securityHeaders", () => {
    it("applies helmet security headers", () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();
      securityHeaders(req, res, next);
      expect(res.getHeader("x-content-type-options")).toBe("nosniff");
      expect(res.getHeader("x-frame-options")).toBe("SAMEORIGIN");
      expect(res.getHeader("referrer-policy")).toBe("no-referrer");
      expect(res.getHeader("cross-origin-resource-policy")).toBe("same-site");
      expect(next).toHaveBeenCalled();
    });

    it("sets a restrictive permissions policy", () => {
      const req = mockReq();
      const res = mockRes();
      securityHeaders(req, res, jest.fn());
      expect(res.getHeader("permissions-policy")).toContain("camera=()");
      expect(res.getHeader("permissions-policy")).toContain("geolocation=()");
      expect(res.getHeader("permissions-policy")).toContain("payment=()");
    });
  });

  describe("ipAbuseGuard", () => {
    beforeEach(() => {
      periodicAbuseCleanup();
    });

    it("allows localhost through", () => {
      const req = mockReq({ ip: "127.0.0.1" });
      const next = jest.fn();
      ipAbuseGuard(req, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("allows an IP under the threshold", () => {
      const req = mockReq({ ip: "10.1.1.1" });
      const next = jest.fn();
      // ABUSE_MAX is 300, so 5 requests should be allowed
      for (let i = 0; i < 5; i += 1) {
        ipAbuseGuard(req, mockRes(), next);
      }
      expect(next).toHaveBeenCalledTimes(5);
    });

    it("returns 429 once an IP exceeds the threshold", () => {
      const req = mockReq({ ip: "10.2.2.2" });
      const res = mockRes();
      const next = jest.fn();
      // ABUSE_MAX is 300, so we need to exceed that
      for (let i = 0; i < 301; i += 1) {
        ipAbuseGuard(req, mockRes(), next);
      }
      ipAbuseGuard(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.objectContaining({ code: "RATE_LIMITED" }) })
      );
    });

    it("resets the window after expiry", () => {
      jest.useFakeTimers();
      const req = mockReq({ ip: "10.3.3.3" });
      const next = jest.fn();
      // ABUSE_MAX is 300, so we need to exceed that
      for (let i = 0; i < 301; i += 1) {
        ipAbuseGuard(req, mockRes(), next);
      }
      // The abuse window is 60s; advance past it so entries are purged.
      jest.advanceTimersByTime(61_000);
      periodicAbuseCleanup();
      const res = mockRes();
      ipAbuseGuard(req, res, next);
      expect(res.status).not.toHaveBeenCalledWith(429);
      jest.useRealTimers();
    });
  });
});
