import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as settingsRepo from "../repositories/settings.repository";
import { cacheService } from "../database/cache";
import { DEFAULT_SETTINGS, SETTING_KEYS, type SettingValue } from "../constants/settings";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

function coerceStoredValue(value: unknown, type: string): SettingValue {
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }
  if (type === "number") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isNaN(num) ? null : num;
  }
  return typeof value === "string" ? value : value === null ? null : String(value);
}

function valueToJson(value: SettingValue): string | number | boolean | null {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null) return null;
  return String(value);
}

export const settingsService = {
  async getPublicSettings() {
    return cacheService.remember<Record<string, SettingValue>>("settings", "public", async () => {
      const stored = await settingsRepo.getPublicSettings();
      const merged: Record<string, SettingValue> = {};
      for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
        if (!def.is_public) continue;
        merged[key] = def.default;
      }
      for (const row of stored) {
        merged[row.key] = coerceStoredValue(row.value, row.type);
      }
      return merged;
    });
  },

  async getAllSettings() {
    return cacheService.remember<Record<string, SettingValue>>("settings", "all", async () => {
      const stored = await settingsRepo.listAllSettings();
      const merged: Record<string, SettingValue> = {};
      for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
        merged[key] = def.default;
      }
      for (const row of stored) {
        merged[row.key] = coerceStoredValue(row.value, row.type);
      }
      return merged;
    });
  },

  async updateSettings(
    patch: Record<string, SettingValue>,
    adminUserId: string,
    req: Request
  ): Promise<Record<string, SettingValue>> {
    const updates: Array<{ key: string; value: SettingValue }> = [];
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(patch)) {
      const definition = DEFAULT_SETTINGS[key];
      if (!definition) {
        throw new ApiError(HttpStatus.BAD_REQUEST, `Unknown setting key: ${key}`, { code: "UNKNOWN_SETTING" });
      }
      oldValues[key] = (await settingsRepo.getByKey(key))?.value ?? definition.default;
      newValues[key] = value;
      updates.push({ key, value });
    }

    for (const update of updates) {
      const definition = DEFAULT_SETTINGS[update.key]!;
      await settingsRepo.upsertSetting({
        key: update.key,
        value: valueToJson(update.value) as never,
        type: definition.type,
        description: definition.description,
        is_public: definition.is_public,
      });
    }

    await cacheService.invalidateNamespace("settings");

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entityType: "settings",
        oldValues,
        newValues,
      },
      req
    );

    return this.getAllSettings();
  },
};

export { SETTING_KEYS };
