jest.mock("../../src/modules/maintenance/maintenance.repository", () => ({
  maintenanceRepository: {
    getState: jest.fn(),
    upsertState: jest.fn(),
    createAuditLog: jest.fn(),
  },
}));

jest.mock("../../src/config/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { maintenanceRepository } from "../../src/modules/maintenance/maintenance.repository";
import { maintenanceService } from "../../src/modules/maintenance/maintenance.service";

const mockGetState = maintenanceRepository.getState as jest.Mock;
const mockUpsertState = maintenanceRepository.upsertState as jest.Mock;
const mockCreateAuditLog = maintenanceRepository.createAuditLog as jest.Mock;

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
        row({ maintenanceEnabled: true, maintenanceMessage: "Contact the developer" })
      );
      const status = await maintenanceService.getPublicStatus();
      expect(status).toEqual({ maintenance: true, message: "Contact the developer" });
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
  });

  describe("enable / disable", () => {
    it("enables maintenance with the provided message", async () => {
      mockUpsertState.mockImplementation((input) =>
        Promise.resolve(
          row({
            maintenanceEnabled: input.maintenanceEnabled,
            maintenanceMessage: input.maintenanceMessage,
            updatedBy: input.updatedBy,
          })
        )
      );
      const state = await maintenanceService.enable({
        message: "Contact the developer",
        updatedBy: "local:operator",
      });
      expect(mockUpsertState).toHaveBeenCalledWith(
        expect.objectContaining({ maintenanceEnabled: true, maintenanceMessage: "Contact the developer" })
      );
      expect(state.maintenanceEnabled).toBe(true);
      expect(state.maintenanceMessage).toBe("Contact the developer");
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "enabled", developerId: "local:operator" })
      );
    });

    it("falls back to the default message when none is provided", async () => {
      mockUpsertState.mockImplementation((input) => Promise.resolve(row(input)));
      await maintenanceService.enable({ updatedBy: "local:operator" });
      expect(mockUpsertState).toHaveBeenCalledWith(
        expect.objectContaining({ maintenanceMessage: expect.stringContaining("scheduled maintenance") })
      );
    });

    it("disables maintenance and clears the cached state", async () => {
      mockUpsertState.mockResolvedValue(row({ maintenanceEnabled: false }));
      const result = await maintenanceService.disable({ updatedBy: "local:operator" });
      expect(result).toEqual({ maintenanceEnabled: false });
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "disabled", developerId: "local:operator" })
      );
      await expireCache();
    });
  });

  describe("audit logging", () => {
    it("does not throw when persisting an audit log fails", async () => {
      mockCreateAuditLog.mockRejectedValue(new Error("write failed"));
      await expect(
        maintenanceService.logAudit("enabled", "local:operator", { ip: "1.1.1.1", userAgent: "x" })
      ).resolves.toBeUndefined();
    });
  });
});
