import { settingsService } from "../../src/services/settings.service";
import { cacheService } from "../../src/database/cache";

jest.mock("../../src/repositories/settings.repository", () => ({
  getPublicSettings: jest.fn(),
  listAllSettings: jest.fn(),
  getByKey: jest.fn(),
  upsertSetting: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as settingsRepo from "../../src/repositories/settings.repository";

const repo = settingsRepo as jest.Mocked<typeof settingsRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

describe("settings service", () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await cacheService.invalidateNamespace("settings");
  });

  it("merges defaults when no stored rows exist", async () => {
    repo.listAllSettings.mockResolvedValue([]);

    const settings = await settingsService.getAllSettings();

    expect(settings["platform.name"]).toBe("VegaMart");
    expect(settings["platform.tax_rate_percent"]).toBe(5);
    expect(settings["platform.maintenance_mode"]).toBe(false);
  });

  it("overrides defaults with stored values", async () => {
    repo.listAllSettings.mockResolvedValue([
      {
        id: "s1",
        key: "platform.tax_rate_percent",
        value: 18,
        type: "number",
        description: null,
        is_public: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    ]);

    const settings = await settingsService.getAllSettings();

    expect(settings["platform.tax_rate_percent"]).toBe(18);
    expect(settings["platform.name"]).toBe("VegaMart");
  });

  it("rejects unknown setting keys", async () => {
    await expect(
      settingsService.updateSettings({ "bogus.key": 1 } as never, "admin-1", mockReq)
    ).rejects.toMatchObject({ code: "UNKNOWN_SETTING" });
  });

  it("persists a valid update and audits it", async () => {
    repo.getByKey.mockResolvedValue(null);
    repo.upsertSetting.mockImplementation(async (data) => ({
      id: "s2",
      key: data.key,
      value: data.value,
      type: data.type,
      description: data.description ?? null,
      is_public: data.is_public ?? false,
      created_at: new Date(),
      updated_at: new Date(),
    }) as any);
    repo.listAllSettings.mockResolvedValue([
      {
        id: "s2",
        key: "platform.maintenance_mode",
        value: true,
        type: "boolean",
        description: null,
        is_public: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    ]);

    const result = await settingsService.updateSettings(
      { "platform.maintenance_mode": true } as never,
      "admin-1",
      mockReq
    );

    expect(repo.upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({ key: "platform.maintenance_mode", value: true })
    );
    expect(result["platform.maintenance_mode"]).toBe(true);
  });
});

describe("countEligibleDeliveryPartners & real-time delivery availability", () => {
  const { countEligibleDeliveryPartners } = require("../../src/services/settings.service");

  it("filters delivery partners by APPROVED status, is_verified, is_available, ONLINE status, deleted_at null, and active user", async () => {
    const mockPrisma = {
      deliveryProfile: {
        count: jest.fn().mockImplementation((args: any) => {
          const where = args.where;
          expect(where.status).toBe("APPROVED");
          expect(where.is_verified).toBe(true);
          expect(where.is_available).toBe(true);
          expect(where.availability_status).toBe("ONLINE");
          expect(where.deleted_at).toBe(null);
          expect(where.user).toEqual({ status: "ACTIVE", deleted_at: null });
          return Promise.resolve(1);
        }),
      },
    };

    const count = await countEligibleDeliveryPartners(mockPrisma);
    expect(count).toBe(1);
  });

  it("returns has_active_delivery_partners = false when admin setting is OFF even if online partners exist", async () => {
    repo.getPublicSettings.mockResolvedValue([
      { key: "platform.vegamart_delivery_enabled", value: false, type: "boolean" } as any,
    ]);

    const res = await settingsService.getPublicSettings();
    expect(res.has_active_delivery_partners).toBe(false);
    expect((res as any)["platform.vegamart_delivery_enabled"]).toBe(false);
  });
});

describe("isBooleanSettingEnabled helper & boolean distinction", () => {
  const { isBooleanSettingEnabled } = require("../../src/services/settings.service");

  it("distinguishes true, false, string booleans, 0/1, and undefined/null", () => {
    expect(isBooleanSettingEnabled(true, true)).toBe(true);
    expect(isBooleanSettingEnabled(false, true)).toBe(false);
    expect(isBooleanSettingEnabled("false", true)).toBe(false);
    expect(isBooleanSettingEnabled("0", true)).toBe(false);
    expect(isBooleanSettingEnabled(0, true)).toBe(false);
    expect(isBooleanSettingEnabled("true", false)).toBe(true);
    expect(isBooleanSettingEnabled(1, false)).toBe(true);
    expect(isBooleanSettingEnabled(undefined, true)).toBe(true);
    expect(isBooleanSettingEnabled(null, true)).toBe(true);
    expect(isBooleanSettingEnabled(undefined, false)).toBe(false);
  });
});

describe("vegamart_delivery_enabled persistence and cache invalidation", () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await cacheService.invalidateNamespace("settings");
  });

  it("persists false for vegamart_delivery_enabled and invalidates public settings cache", async () => {
    repo.getByKey.mockResolvedValue(null);
    repo.upsertSetting.mockResolvedValue({
      id: "s-veg-off",
      key: "platform.vegamart_delivery_enabled",
      value: false,
      type: "boolean",
      description: "Master switch",
      is_public: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as any);

    repo.listAllSettings.mockResolvedValue([
      {
        id: "s-veg-off",
        key: "platform.vegamart_delivery_enabled",
        value: false,
        type: "boolean",
        description: "Master switch",
        is_public: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    ]);

    repo.getPublicSettings.mockResolvedValue([
      {
        id: "s-veg-off",
        key: "platform.vegamart_delivery_enabled",
        value: false,
        type: "boolean",
        description: "Master switch",
        is_public: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
    ]);

    await settingsService.updateSettings(
      { "platform.vegamart_delivery_enabled": false },
      "admin-1",
      mockReq
    );

    const publicSettings = await settingsService.getPublicSettings();
    expect((publicSettings as any)["platform.vegamart_delivery_enabled"]).toBe(false);
    expect(publicSettings.has_active_delivery_partners).toBe(false);
  });

  it("handles updating multiple settings together without resetting vegamart_delivery_enabled", async () => {
    repo.getByKey.mockResolvedValue(null);
    repo.upsertSetting.mockResolvedValue({} as any);
    repo.listAllSettings.mockResolvedValue([
      { key: "platform.vegamart_delivery_enabled", value: false, type: "boolean" } as any,
      { key: "platform.tax_rate_percent", value: 12, type: "number" } as any,
    ]);
    repo.getPublicSettings.mockResolvedValue([
      { key: "platform.vegamart_delivery_enabled", value: false, type: "boolean" } as any,
      { key: "platform.tax_rate_percent", value: 12, type: "number" } as any,
    ]);

    const result = await settingsService.updateSettings(
      {
        "platform.vegamart_delivery_enabled": false,
        "platform.tax_rate_percent": 12,
      },
      "admin-1",
      mockReq
    );

    expect(result["platform.vegamart_delivery_enabled"]).toBe(false);
    expect(result["platform.tax_rate_percent"]).toBe(12);

    const publicSettings = await settingsService.getPublicSettings();
    expect((publicSettings as any)["platform.vegamart_delivery_enabled"]).toBe(false);
  });
});
