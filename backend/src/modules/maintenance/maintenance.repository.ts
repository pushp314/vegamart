import prisma from "../../database/prisma";
import { MAINTENANCE_MODULE_SINGLETON_ID } from "./maintenance.constants";
import type { MaintenanceAuditEntry, SystemSettingRow } from "./maintenance.types";

export const maintenanceRepository = {
  async getState(): Promise<SystemSettingRow | null> {
    return prisma.systemSetting.findUnique({
      where: { id: MAINTENANCE_MODULE_SINGLETON_ID },
    });
  },

  async upsertState(input: {
    maintenanceEnabled: boolean;
    maintenanceMessage: string | null;
    updatedBy: string;
  }): Promise<SystemSettingRow> {
    return prisma.systemSetting.upsert({
      where: { id: MAINTENANCE_MODULE_SINGLETON_ID },
      update: {
        maintenanceEnabled: input.maintenanceEnabled,
        maintenanceMessage: input.maintenanceMessage,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
      create: {
        id: MAINTENANCE_MODULE_SINGLETON_ID,
        maintenanceEnabled: input.maintenanceEnabled,
        maintenanceMessage: input.maintenanceMessage,
        updatedBy: input.updatedBy,
      },
    });
  },

  async createAuditLog(entry: MaintenanceAuditEntry) {
    return prisma.maintenanceAuditLog.create({
      data: {
        action: entry.action,
        developerId: entry.developerId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        message: entry.message ?? null,
      },
    });
  },

  async listAuditLogs(limit = 50) {
    return prisma.maintenanceAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  },
};
