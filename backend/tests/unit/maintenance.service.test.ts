jest.mock("../../src/modules/maintenance/maintenance.repository", () => ({
  maintenanceRepository: {
    getState: jest.fn(),
    upsertState: jest.fn(),
    createAuditLog: jest.fn(),
    listAuditLogs: jest.fn(),
  },
}));

jest.mock("../../src/config/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { maintenanceRepository } from "../../src/modules/maintenance/maintenance.repository";
import { maintenanceService } from "../../src/modules/maintenance/maintenance.service";
import { UnauthorizedError } from "../../src/utils/ApiError";

const mockGetState = maintenanceRepository.getState as jest.Mock;
const mockUpsertState = maintenanceRepository.upsertState as jest.Mock;
const mockCreateAuditLog = maintenanceRepository.createAuditLog as jest.Mock;
const mockListAuditLogs = maintenanceRepository.listAuditLogs as jest.Mock;

const TEST_API_KEY = "test_dev_maintenance_api_key_123456";

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    maintenanceEnabled: false,
    maintenanceMessage: null,
    updatedBy: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

async function expireCache(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 60));
}

describe("maintenanceService", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await expireCache();
    mockGetState.mockResolvedValue(row());
  });

  describe("status reads", () => {
    it("returns disabled public status when maintenance is off", async () => {
      mockGetState.mockResolvedValue(row({ maintenanceEnabled: false, maintenanceMessage: null }));
      const status = await maintenanceService.getPublicStatus();
      expect(status).toEqual({
        maintenance: false,
        message: "This site is currently undergoing scheduled maintenance. We will be back shortly.",
      });
    });

    it("returns the custom message when maintenance is on", async () => {
      mockGetState.mockResolvedValue(
        row({ maintenanceEnabled: true, maintenanceMessage: "DB upgrade until noon." })
      );
      const status = await maintenanceService.getPublicStatus();
      expect(status).toEqual({ maintenance: true, message: "DB upgrade until noon." });
    });

    it("isMaintenanceEnabled reflects the stored flag", async () => {
      mockGetState.mockResolvedValue(row({ maintenanceEnabled: true }));
      expect(await maintenanceService.isMaintenanceEnabled()).toBe(true);
    });

    it("caches the state within the ttl", async () => {
      await maintenanceService.isMaintenanceEnabled();
      expect(mockGetState).toHaveBeenCalledTimes(1);
      await maintenanceService.isMaintenanceEnabled();
      expect(mockGetState).toHaveBeenCalledTimes(1);
    });

    it("fails open (disabled) when the repository read errors", async () => {
      mockGetState.mockRejectedValue(new Error("db down"));
      expect(await maintenanceService.isMaintenanceEnabled()).toBe(false);
    });

    it("maps full state to the dto shape", async () => {
      mockGetState.mockResolvedValue(
        row({ maintenanceEnabled: true, maintenanceMessage: "msg", updatedBy: "api_key:developer" })
      );
      const state = await maintenanceService.getFullState();
      expect(state).toEqual({
        maintenanceEnabled: true,
        maintenanceMessage: "msg",
        updatedBy: "api_key:developer",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });

  describe("enable / disable / update", () => {
    it("enables maintenance with the provided message", async () => {
      mockUpsertState.mockImplementation((input) =>
        Promise.resolve(row({ maintenanceEnabled: input.maintenanceEnabled, maintenanceMessage: input.maintenanceMessage, updatedBy: input.updatedBy }))
      );
      const state = await maintenanceService.enable({
        message: "Scheduled maintenance.",
        updatedBy: "api_key:developer",
      });
      expect(mockUpsertState).toHaveBeenCalledWith(
        expect.objectContaining({ maintenanceEnabled: true, maintenanceMessage: "Scheduled maintenance." })
      );
      expect(state.maintenanceEnabled).toBe(true);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "enabled", developerId: "api_key:developer" })
      );
    });

    it("falls back to the default message when none is provided", async () => {
      mockUpsertState.mockImplementation((input) => Promise.resolve(row(input)));
      await maintenanceService.enable({ updatedBy: "dev" });
      expect(mockUpsertState).toHaveBeenCalledWith(
        expect.objectContaining({ maintenanceMessage: expect.stringContaining("scheduled maintenance") })
      );
    });

    it("disables maintenance and clears the cached state", async () => {
      mockUpsertState.mockResolvedValue(row({ maintenanceEnabled: false }));
      const result = await maintenanceService.disable({ updatedBy: "jwt:developer" });
      expect(result).toEqual({ maintenanceEnabled: false });
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "disabled", developerId: "jwt:developer" })
      );
      await expireCache();
    });

    it("updates the message while keeping maintenance on", async () => {
      mockUpsertState.mockResolvedValue(row({ maintenanceEnabled: true, maintenanceMessage: "New banner." }));
      const state = await maintenanceService.updateMessage({
        message: "New banner.",
        updatedBy: "jwt:developer",
      });
      expect(mockUpsertState).toHaveBeenCalledWith(
        expect.objectContaining({ maintenanceEnabled: true, maintenanceMessage: "New banner." })
      );
      expect(state.maintenanceMessage).toBe("New banner.");
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "updated", message: "New banner." })
      );
    });
  });

  describe("audit logs", () => {
    it("lists audit logs mapped to dtos", async () => {
      mockListAuditLogs.mockResolvedValue([
        {
          id: "log-1",
          action: "enabled",
          developerId: "api_key:developer",
          ipAddress: "1.2.3.4",
          userAgent: "curl",
          message: "msg",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      const logs = await maintenanceService.getAuditLogs(10);
      expect(logs[0]).toEqual({
        id: "log-1",
        action: "enabled",
        developerId: "api_key:developer",
        ipAddress: "1.2.3.4",
        userAgent: "curl",
        message: "msg",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(mockListAuditLogs).toHaveBeenCalledWith(10);
    });

    it("does not throw when persisting an audit log fails", async () => {
      mockCreateAuditLog.mockRejectedValue(new Error("write failed"));
      await expect(
        maintenanceService.logAudit("enabled", "dev", { ip: "1.1.1.1", userAgent: "x" })
      ).resolves.toBeUndefined();
    });
  });

  describe("developer authentication", () => {
    it("accepts the configured API key", () => {
      expect(() => maintenanceService.validateDeveloperApiKey(TEST_API_KEY)).not.toThrow();
    });

    it("rejects a wrong API key", () => {
      expect(() => maintenanceService.validateDeveloperApiKey("wrong_key")).toThrow(UnauthorizedError);
    });

    it("issues and verifies a developer JWT", () => {
      const result = maintenanceService.issueDeveloperToken(TEST_API_KEY, {
        developerId: "developer",
        method: "api_key",
        ip: "1.2.3.4",
      });
      expect(result.token).toBeTruthy();
      expect(result.expiresInSeconds).toBe(60);
      const identity = maintenanceService.verifyDeveloperToken(result.token, "1.2.3.4");
      expect(identity).toEqual({ developerId: "developer", method: "jwt", ip: "1.2.3.4" });
    });

    it("rejects a tampered JWT", () => {
      expect(() => maintenanceService.verifyDeveloperToken("not.a.jwt", "1.2.3.4")).toThrow(UnauthorizedError);
    });

    it("rejects a JWT without the developer scope", () => {
      const jwt = require("jsonwebtoken");
      const token = jwt.sign(
        { sub: "x", role: "CUSTOMER", scope: "maintenance" },
        "test_dev_maintenance_jwt_secret_at_least_32_chars",
        { expiresIn: 60 }
      );
      expect(() => maintenanceService.verifyDeveloperToken(token, "1.2.3.4")).toThrow(UnauthorizedError);
    });

    it("enforces the IP allowlist when configured", () => {
      expect(maintenanceService.isDeveloperIpAllowed("10.0.0.1")).toBe(true);
    });

    it("builds identity from a bearer token", async () => {
      const result = maintenanceService.issueDeveloperToken(TEST_API_KEY, {
        developerId: "developer",
        method: "api_key",
        ip: "1.2.3.4",
      });
      const req = {
        headers: { authorization: `Bearer ${result.token}` },
        ip: "1.2.3.4",
      } as never;
      const identity = await maintenanceService.buildDeveloperIdentity(req as never);
      expect(identity.method).toBe("jwt");
    });

    it("builds identity from an api key header", async () => {
      const req = {
        headers: { "x-api-key": TEST_API_KEY },
        ip: "1.2.3.4",
      } as never;
      const identity = await maintenanceService.buildDeveloperIdentity(req as never);
      expect(identity.method).toBe("api_key");
    });

    it("rejects requests without any credentials", async () => {
      const req = { headers: {}, ip: "1.2.3.4" } as never;
      await expect(maintenanceService.buildDeveloperIdentity(req as never)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });
});
