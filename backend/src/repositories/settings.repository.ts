import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  key: true,
  value: true,
  type: true,
  description: true,
  is_public: true,
  created_at: true,
  updated_at: true,
} as const;

export type SettingRow = {
  id: string;
  key: string;
  value: Prisma.JsonValue;
  type: string;
  description: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function getByKey(key: string): Promise<SettingRow | null> {
  const row = await prisma.setting.findUnique({ where: { key }, select: baseSelect });
  return row as unknown as SettingRow | null;
}

export async function getByKeys(keys: string[]): Promise<SettingRow[]> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
    select: baseSelect,
  });
  return rows as unknown as SettingRow[];
}

export async function getPublicSettings(): Promise<SettingRow[]> {
  const rows = await prisma.setting.findMany({
    where: { is_public: true },
    select: baseSelect,
  });
  return rows as unknown as SettingRow[];
}

export async function upsertSetting(data: {
  key: string;
  value: Prisma.InputJsonValue;
  type: string;
  description?: string | null;
  is_public?: boolean;
}): Promise<SettingRow> {
  const row = await prisma.setting.upsert({
    where: { key: data.key },
    update: {
      value: data.value,
      type: data.type,
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.is_public !== undefined ? { is_public: data.is_public } : {}),
    },
    create: {
      key: data.key,
      value: data.value,
      type: data.type,
      description: data.description ?? null,
      is_public: data.is_public ?? false,
    },
    select: baseSelect,
  });
  return row as unknown as SettingRow;
}

export async function listAllSettings(): Promise<SettingRow[]> {
  const rows = await prisma.setting.findMany({
    orderBy: { key: "asc" },
    select: baseSelect,
  });
  return rows as unknown as SettingRow[];
}
