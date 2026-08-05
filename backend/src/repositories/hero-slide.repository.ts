import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  title: true,
  subtitle: true,
  body: true,
  image_url: true,
  link_url: true,
  link_text: true,
  is_active: true,
  sort_order: true,
  created_by: true,
  created_at: true,
  updated_at: true,
} as const;

export type HeroSlideRow = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function findById(id: string): Promise<HeroSlideRow | null> {
  const row = await prisma.heroSlide.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as HeroSlideRow | null;
}

export interface HeroSlideFilter {
  q?: string;
  isActive?: boolean;
}

export async function listHeroSlides(
  filter: HeroSlideFilter,
  skip: number,
  take: number
): Promise<{ rows: HeroSlideRow[]; total: number }> {
  const where: Prisma.HeroSlideWhereInput = { deleted_at: null };
  if (filter.isActive !== undefined) where.is_active = filter.isActive;
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { body: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.heroSlide.findMany({
      where,
      select: baseSelect,
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
      skip,
      take,
    }),
    prisma.heroSlide.count({ where }),
  ]);
  return { rows: rows as unknown as HeroSlideRow[], total };
}

export interface CreateHeroSlideInput {
  title: string;
  subtitle?: string;
  body?: string;
  image_url?: string;
  link_url?: string;
  link_text?: string;
  is_active?: boolean;
  sort_order?: number;
  created_by?: string;
}

export async function createHeroSlide(data: CreateHeroSlideInput): Promise<HeroSlideRow> {
  const row = await prisma.heroSlide.create({
    data: {
      title: data.title,
      subtitle: data.subtitle ?? null,
      body: data.body ?? null,
      image_url: data.image_url ?? null,
      link_url: data.link_url ?? null,
      link_text: data.link_text ?? null,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 0,
      created_by: data.created_by ?? null,
    },
    select: baseSelect,
  });
  return row as unknown as HeroSlideRow;
}

export async function updateHeroSlide(id: string, data: Prisma.HeroSlideUpdateInput): Promise<HeroSlideRow> {
  const row = await prisma.heroSlide.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as HeroSlideRow;
}

export async function softDelete(id: string): Promise<HeroSlideRow> {
  const row = await prisma.heroSlide.update({
    where: { id },
    data: { deleted_at: new Date() },
    select: baseSelect,
  });
  return row as unknown as HeroSlideRow;
}