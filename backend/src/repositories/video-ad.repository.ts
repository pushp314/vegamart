import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  title: true,
  subtitle: true,
  video_url: true,
  thumbnail_url: true,
  cta_text: true,
  cta_link: true,
  display_mode: true,
  duration: true,
  is_active: true,
  sort_order: true,
  created_by: true,
  created_at: true,
  updated_at: true,
} as const;

export type VideoAdRow = {
  id: string;
  title: string | null;
  subtitle: string | null;
  video_url: string;
  thumbnail_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  display_mode: string;
  duration: number;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function findById(id: string): Promise<VideoAdRow | null> {
  const row = await prisma.videoAd.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as VideoAdRow | null;
}

export interface VideoAdFilter {
  q?: string;
  isActive?: boolean;
  displayMode?: string;
}

export async function listVideoAds(
  filter: VideoAdFilter,
  skip: number,
  take: number
): Promise<{ rows: VideoAdRow[]; total: number }> {
  const where: Prisma.VideoAdWhereInput = { deleted_at: null };
  if (filter.isActive !== undefined) where.is_active = filter.isActive;
  if (filter.displayMode) where.display_mode = filter.displayMode;
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { subtitle: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.videoAd.findMany({
      where,
      select: baseSelect,
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
      skip,
      take,
    }),
    prisma.videoAd.count({ where }),
  ]);
  return { rows: rows as unknown as VideoAdRow[], total };
}

export async function getActivePublicVideoAds(): Promise<VideoAdRow[]> {
  const rows = await prisma.videoAd.findMany({
    where: { is_active: true, deleted_at: null },
    select: baseSelect,
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
  });
  return rows as unknown as VideoAdRow[];
}

export interface CreateVideoAdInput {
  title?: string | null;
  subtitle?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  display_mode?: string;
  duration?: number;
  is_active?: boolean;
  sort_order?: number;
  created_by?: string;
}

export async function createVideoAd(data: CreateVideoAdInput): Promise<VideoAdRow> {
  const row = await prisma.videoAd.create({
    data: {
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      video_url: data.video_url,
      thumbnail_url: data.thumbnail_url ?? null,
      cta_text: data.cta_text ?? "Watch 30s Ad",
      cta_link: data.cta_link ?? null,
      display_mode: data.display_mode ?? "watch_cta",
      duration: data.duration ?? 30,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 0,
      created_by: data.created_by ?? null,
    },
    select: baseSelect,
  });
  return row as unknown as VideoAdRow;
}

export async function updateVideoAd(id: string, data: Prisma.VideoAdUpdateInput): Promise<VideoAdRow> {
  const row = await prisma.videoAd.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as VideoAdRow;
}

export async function softDelete(id: string): Promise<VideoAdRow> {
  const row = await prisma.videoAd.update({
    where: { id },
    data: { deleted_at: new Date() },
    select: baseSelect,
  });
  return row as unknown as VideoAdRow;
}

