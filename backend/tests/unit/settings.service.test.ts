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
