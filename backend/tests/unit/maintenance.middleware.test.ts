jest.mock("../../src/modules/maintenance/maintenance.service", () => ({
  maintenanceService: {
    isMaintenanceEnabled: jest.fn(),
    getPublicStatus: jest.fn(),
    extractAuditContext: jest.fn(() => ({ ip: "10.0.0.1", userAgent: "jest" })),
  },
}));

jest.mock("../../src/config/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import type { Request, Response } from "express";
import { maintenanceService } from "../../src/modules/maintenance/maintenance.service";
import { checkMaintenanceMode, requireLoopback } from "../../src/modules/maintenance/maintenance.middleware";

const mockIsEnabled = maintenanceService.isMaintenanceEnabled as jest.Mock;
const mockGetPublicStatus = maintenanceService.getPublicStatus as jest.Mock;

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    originalUrl: "/api/v1/products",
    ip: "10.0.0.1",
    headers: {},
    socket: { remoteAddress: "10.0.0.1" },
    ...overrides,
  } as unknown as Request;
}

describe("checkMaintenanceMode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes through when maintenance is disabled", async () => {
    mockIsEnabled.mockResolvedValue(false);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns 503 with the maintenance payload when enabled", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetPublicStatus.mockResolvedValue({ maintenance: true, message: "Contact the developer" });
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ maintenance: true, message: "Contact the developer" });
    expect(next).not.toHaveBeenCalled();
  });

  it("skips excluded exact paths even when enabled", async () => {
    mockIsEnabled.mockResolvedValue(true);
    const req = mockReq({ originalUrl: "/api/v1/system/maintenance/status" });
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode({ excludedPathPrefixes: ["/api/v1/system"] })(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("skips excluded path prefixes (health, docs, metrics)", async () => {
    mockIsEnabled.mockResolvedValue(true);
    const req = mockReq({ originalUrl: "/api/v1/health/db" });
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode({ excludedPathPrefixes: ["/api/v1/health"] })(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("honours a custom exclude callback", async () => {
    mockIsEnabled.mockResolvedValue(true);
    const req = mockReq({ originalUrl: "/api/v1/custom" });
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode({ exclude: (r) => r.originalUrl.startsWith("/api/v1/custom") })(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("fails open when the status check errors", async () => {
    mockIsEnabled.mockRejectedValue(new Error("db down"));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("requireLoopback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes through when the request comes from loopback", () => {
    const req = mockReq({ socket: { remoteAddress: "127.0.0.1" } });
    const res = mockRes();
    const next = jest.fn();
    requireLoopback(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the request comes from a remote address", () => {
    const req = mockReq({ socket: { remoteAddress: "10.0.0.1" } });
    const res = mockRes();
    const next = jest.fn();
    requireLoopback(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
