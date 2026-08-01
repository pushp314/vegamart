import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  parent_id: true,
  name: true,
  slug: true,
  icon: true,
  color: true,
  image_url: true,
  sort_order: true,
  is_active: true,
  is_featured: true,
  created_at: true,
  updated_at: true,
} as const;

export type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function existsById(id: string): Promise<boolean> {
  const found = await prisma.category.findFirst({
    where: { id, deleted_at: null },
    select: { id: true },
  });
  return found !== null;
}

export async function findById(id: string): Promise<CategoryRow | null> {
  const row = await prisma.category.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as CategoryRow | null;
}

export async function findBySlug(slug: string): Promise<CategoryRow | null> {
  const row = await prisma.category.findFirst({
    where: { slug, deleted_at: null },
    select: baseSelect,
  });
  return row as unknown as CategoryRow | null;
}

export async function listAll(includeInactive = false): Promise<CategoryRow[]> {
  const where: Prisma.CategoryWhereInput = { deleted_at: null };
  if (!includeInactive) {
    where.is_active = true;
  }
  const rows = await prisma.category.findMany({
    where,
    select: baseSelect,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });
  return rows as unknown as CategoryRow[];
}

export async function listPaged(
  includeInactive: boolean,
  skip: number,
  take: number
): Promise<{ rows: CategoryRow[]; total: number }> {
  const where: Prisma.CategoryWhereInput = { deleted_at: null };
  if (!includeInactive) {
    where.is_active = true;
  }
  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      select: baseSelect,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      skip,
      take,
    }),
    prisma.category.count({ where }),
  ]);
  return { rows: rows as unknown as CategoryRow[], total };
}

export async function listSlugs(exceptId?: string): Promise<Set<string>> {
  const rows = await prisma.category.findMany({
    where: { deleted_at: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
}

export async function createCategory(data: {
  name: string;
  slug: string;
  parent_id?: string | null;
  icon?: string | null;
  color?: string | null;
  image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  is_featured?: boolean;
}): Promise<CategoryRow> {
  const row = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      parent_id: data.parent_id ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      image_url: data.image_url ?? null,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
      is_featured: data.is_featured ?? false,
    },
    select: baseSelect,
  });
  return row as unknown as CategoryRow;
}

export async function updateCategory(id: string, data: Prisma.CategoryUpdateInput): Promise<CategoryRow> {
  const row = await prisma.category.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as CategoryRow;
}

export async function softDelete(id: string): Promise<void> {
  await prisma.category.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}
