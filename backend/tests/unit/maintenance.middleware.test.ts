jest.mock("../../src/modules/maintenance/maintenance.service", () => ({
  maintenanceService: {
    isMaintenanceEnabled: jest.fn(),
    getPublicStatus: jest.fn(),
    isDeveloperIpAllowed: jest.fn(),
    buildDeveloperIdentity: jest.fn(),
    logAudit: jest.fn(),
    extractAuditContext: jest.fn(() => ({ ip: "10.0.0.1", userAgent: "jest" })),
  },
}));

jest.mock("../../src/config/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import type { Request, Response } from "express";
import { maintenanceService } from "../../src/modules/maintenance/maintenance.service";
import { checkMaintenanceMode, requireDeveloper } from "../../src/modules/maintenance/maintenance.middleware";

const mockIsEnabled = maintenanceService.isMaintenanceEnabled as jest.Mock;
const mockGetPublicStatus = maintenanceService.getPublicStatus as jest.Mock;
const mockIsIpAllowed = maintenanceService.isDeveloperIpAllowed as jest.Mock;
const mockBuildIdentity = maintenanceService.buildDeveloperIdentity as jest.Mock;
const mockLogAudit = maintenanceService.logAudit as jest.Mock;

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
    mockGetPublicStatus.mockResolvedValue({ maintenance: true, message: "Down for upgrade." });
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await checkMaintenanceMode()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ maintenance: true, message: "Down for upgrade." });
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

describe("requireDeveloper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsIpAllowed.mockReturnValue(true);
  });

  it("attaches the identity and calls next on success", async () => {
    mockBuildIdentity.mockResolvedValue({ developerId: "developer", method: "jwt", ip: "10.0.0.1" });
    const req = mockReq({ headers: { authorization: "Bearer x" } }) as Request & { maintenanceDeveloper?: unknown };
    const res = mockRes();
    const next = jest.fn();
    await new Promise<void>((resolve) => {
      requireDeveloper(req, res, (err?: unknown) => {
        next(err);
        resolve();
      });
    });
    expect(req.maintenanceDeveloper).toEqual({ developerId: "developer", method: "jwt", ip: "10.0.0.1" });
    expect(next).toHaveBeenCalled();
  });

  it("rejects with 403 when the IP is not allowed", async () => {
    mockIsIpAllowed.mockReturnValue(false);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await new Promise<void>((resolve) => {
      requireDeveloper(req, res, (err) => {
        next(err);
        resolve();
      });
    });
    const error = next.mock.calls[0][0] as Error & { statusCode?: number };
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(403);
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it("forwards auth failures to next and logs an audit entry", async () => {
    mockBuildIdentity.mockRejectedValue(new Error("Invalid developer API key."));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await new Promise<void>((resolve) => {
      requireDeveloper(req, res, (err) => {
        next(err);
        resolve();
      });
    });
    expect(next.mock.calls[0][0]).toEqual(new Error("Invalid developer API key."));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.any(String),
      "developer",
      expect.objectContaining({ ip: "10.0.0.1" }),
      "Invalid developer API key."
    );
  });
});
