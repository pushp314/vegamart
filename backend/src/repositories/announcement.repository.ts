import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  title: true,
  body: true,
  audience: true,
  is_active: true,
  scheduled_at: true,
  published_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
} as const;

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  is_active: boolean;
  scheduled_at: Date | null;
  published_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function findById(id: string): Promise<AnnouncementRow | null> {
  const row = await prisma.announcement.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as AnnouncementRow | null;
}

export interface AnnouncementFilter {
  q?: string;
  audience?: string;
  isActive?: boolean;
  published?: boolean;
}

export async function listAnnouncements(
  filter: AnnouncementFilter,
  skip: number,
  take: number
): Promise<{ rows: AnnouncementRow[]; total: number }> {
  const where: Prisma.AnnouncementWhereInput = { deleted_at: null };
  if (filter.audience) where.audience = filter.audience;
  if (filter.isActive !== undefined) where.is_active = filter.isActive;
  if (filter.published !== undefined) {
    where.published_at = filter.published ? { not: null } : { equals: null };
  }
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { body: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      select: baseSelect,
      orderBy: [{ published_at: "desc" }, { created_at: "desc" }],
      skip,
      take,
    }),
    prisma.announcement.count({ where }),
  ]);
  return { rows: rows as unknown as AnnouncementRow[], total };
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience?: string;
  is_active?: boolean;
  scheduled_at?: Date | null;
  created_by?: string | null;
}

export async function createAnnouncement(data: CreateAnnouncementInput): Promise<AnnouncementRow> {
  const row = await prisma.announcement.create({
    data: {
      title: data.title,
      body: data.body,
      audience: data.audience ?? "all",
      is_active: data.is_active ?? true,
      scheduled_at: data.scheduled_at ?? null,
      created_by: data.created_by ?? null,
    },
    select: baseSelect,
  });
  return row as unknown as AnnouncementRow;
}

export async function updateAnnouncement(id: string, data: Prisma.AnnouncementUpdateInput): Promise<AnnouncementRow> {
  const row = await prisma.announcement.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as AnnouncementRow;
}

export async function softDelete(id: string): Promise<AnnouncementRow> {
  const row = await prisma.announcement.update({
    where: { id },
    data: { deleted_at: new Date() },
    select: baseSelect,
  });
  return row as unknown as AnnouncementRow;
}
