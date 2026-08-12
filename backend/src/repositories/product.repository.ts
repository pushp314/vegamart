import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  vendor_id: true,
  category_id: true,
  subcategory_id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  mrp: true,
  unit: true,
  variants: true,
  tag: true,
  is_active: true,
  is_featured: true,
  is_vegetarian: true,
  rating: true,
  review_count: true,
  stock: true,
  total_stock: true,
  is_available: true,
  created_at: true,
  updated_at: true,
  images: {
    select: { id: true, url: true, alt_text: true, sort_order: true, is_primary: true },
    orderBy: { sort_order: "asc" as const },
  },
  vendor: {
    select: { id: true, business_name: true, logo_url: true, status: true, is_sponsored: true, free_delivery_min_order: true, is_open: true, provides_delivery: true },
  },
} as const;

export type ProductRow = {
  id: string;
  vendor_id: string;
  category_id: string;
  subcategory_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: import("@prisma/client").Prisma.Decimal;
  mrp: import("@prisma/client").Prisma.Decimal;
  unit: string;
  variants: any | null;
  tag: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_vegetarian: boolean | null;
  rating: number;
  review_count: number;
  stock: number;
  total_stock: number;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
  images: Array<{
    id: string;
    url: string;
    alt_text: string | null;
    sort_order: number;
    is_primary: boolean;
  }>;
  vendor?: {
    id: string;
    business_name: string;
    logo_url: string | null;
    status: import("@prisma/client").VendorStatus;
    is_sponsored?: boolean;
    free_delivery_min_order?: import("@prisma/client").Prisma.Decimal | null;
    is_open?: boolean;
    provides_delivery?: boolean;
  } | null;
};

function mapRow(row: unknown): ProductRow {
  return row as ProductRow;
}

export async function findById(id: string): Promise<ProductRow | null> {
  const row = await prisma.product.findFirst({
    where: { id, deleted_at: null },
    select: baseSelect,
  });
  return row ? mapRow(row) : null;
}

export async function findByIdIncludingDeleted(id: string): Promise<ProductRow | null> {
  const row = await prisma.product.findFirst({
    where: { id },
    select: baseSelect,
  });
  return row ? mapRow(row) : null;
}

export async function listSlugs(vendorId: string, exceptId?: string): Promise<Set<string>> {
  const rows = await prisma.product.findMany({
    where: {
      vendor_id: vendorId,
      deleted_at: null,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
}

export async function countForVendor(vendorId: string): Promise<number> {
  return prisma.product.count({
    where: { vendor_id: vendorId, deleted_at: null },
  });
}

export interface ProductListFilter {
  q?: string;
  vendorId?: string;
  categoryId?: string;
  subcategoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isVegetarian?: boolean;
  isAvailable?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  tag?: string;
  sort?: string;
  includeInactive?: boolean;
}

export async function listProducts(
  filter: ProductListFilter,
  skip: number,
  take: number
): Promise<{ rows: ProductRow[]; total: number }> {
  const where: Prisma.ProductWhereInput = { deleted_at: null };

  if (!filter.includeInactive) {
    where.is_active = true;
    where.is_available = true;
    where.vendor = { is_open: true, status: "APPROVED", deleted_at: null };
  }
  if (filter.vendorId) where.vendor_id = filter.vendorId;
  if (filter.categoryId) where.category_id = filter.categoryId;
  if (filter.subcategoryId) where.subcategory_id = filter.subcategoryId;
  if (filter.tag) where.tag = filter.tag;
  if (filter.isVegetarian !== undefined) where.is_vegetarian = filter.isVegetarian;
  if (filter.isAvailable !== undefined) where.is_available = filter.isAvailable;
  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
    where.price = {
      ...(filter.minPrice !== undefined ? { gte: filter.minPrice } : {}),
      ...(filter.maxPrice !== undefined ? { lte: filter.maxPrice } : {}),
    };
  }
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { slug: { contains: filter.q, mode: "insensitive" } },
      { description: { contains: filter.q, mode: "insensitive" } },
      { tag: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const orderBy = buildOrderBy(filter.sort);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: baseSelect,
      orderBy,
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);
  return { rows: rows.map(mapRow), total };
}

export async function listProductsAdmin(
  filter: ProductListFilter,
  skip: number,
  take: number
): Promise<{ rows: ProductRow[]; total: number }> {
  const where: Prisma.ProductWhereInput = { deleted_at: null };

  if (filter.vendorId) where.vendor_id = filter.vendorId;
  if (filter.categoryId) where.category_id = filter.categoryId;
  if (filter.isActive !== undefined) where.is_active = filter.isActive;
  if (filter.isFeatured !== undefined) where.is_featured = filter.isFeatured;
  if (filter.isAvailable !== undefined) where.is_available = filter.isAvailable;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { slug: { contains: filter.q, mode: "insensitive" } },
      { description: { contains: filter.q, mode: "insensitive" } },
      { tag: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const orderBy = buildOrderBy(filter.sort);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        ...baseSelect,
        vendor: { select: { id: true, business_name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);
  return { rows: rows as unknown as ProductRow[], total };
}

export async function listByVendor(
  vendorId: string,
  includeInactive: boolean,
  q: string | undefined,
  skip: number,
  take: number
): Promise<{ rows: ProductRow[]; total: number }> {
  const where: Prisma.ProductWhereInput = { vendor_id: vendorId, deleted_at: null };
  if (!includeInactive) {
    where.is_active = true;
  }
  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  }
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: baseSelect,
      orderBy: [{ created_at: "desc" }],
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);
  return { rows: rows.map(mapRow), total };
}

export async function listByVendorIds(
  vendorIds: string[],
  options: { categoryId?: string; q?: string; skip?: number; take?: number } = {}
): Promise<{ rows: ProductRow[]; total: number }> {
  if (vendorIds.length === 0) {
    return { rows: [], total: 0 };
  }
  const where: Prisma.ProductWhereInput = {
    vendor_id: { in: vendorIds },
    deleted_at: null,
    is_active: true,
    is_available: true,
    vendor: { is_open: true, status: "APPROVED", deleted_at: null },
  };
  if (options.categoryId) where.category_id = options.categoryId;
  if (options.q) {
    where.OR = [
      { name: { contains: options.q, mode: "insensitive" } },
      { tag: { contains: options.q, mode: "insensitive" } },
      { description: { contains: options.q, mode: "insensitive" } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: baseSelect,
      orderBy: [{ is_featured: "desc" }, { rating: "desc" }, { created_at: "desc" }],
      skip: options.skip ?? 0,
      take: options.take ?? 50,
    }),
    prisma.product.count({ where }),
  ]);
  return { rows: rows.map(mapRow), total };
}

export async function createProduct(data: {
  vendor_id: string;
  category_id: string;
  subcategory_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  mrp: number;
  unit: string;
  variants?: Array<{ unit: string; price: number; mrp?: number | null }> | null;
  tag?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  is_vegetarian?: boolean | null;
  stock?: number;
  total_stock?: number;
  is_available?: boolean;
}): Promise<ProductRow> {
  const stock = data.stock ?? 0;
  const row = await prisma.product.create({
    data: {
      vendor_id: data.vendor_id,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      price: data.price,
      mrp: data.mrp,
      unit: data.unit,
      variants: (data.variants ?? null) as Prisma.InputJsonValue | undefined,
      tag: data.tag ?? null,
      is_active: data.is_active ?? true,
      is_featured: data.is_featured ?? false,
      is_vegetarian: data.is_vegetarian ?? null,
      stock,
      total_stock: data.total_stock ?? stock,
      is_available: data.is_available ?? true,
    },
    select: baseSelect,
  });
  return mapRow(row);
}

export async function updateProduct(id: string, data: Prisma.ProductUpdateInput): Promise<ProductRow> {
  const row = await prisma.product.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return mapRow(row);
}

export async function softDelete(id: string): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false, is_available: false },
  });
}

export async function addImage(productId: string, image: { url: string; alt_text?: string | null; is_primary?: boolean }) {
  const count = await prisma.productImage.count({ where: { product_id: productId } });
  const isPrimary = image.is_primary ?? count === 0;
  return prisma.productImage.create({
    data: {
      product_id: productId,
      url: image.url,
      alt_text: image.alt_text ?? null,
      sort_order: count,
      is_primary: isPrimary,
    },
  });
}

export async function removeImage(productId: string, imageId: string): Promise<boolean> {
  const deleted = await prisma.productImage.deleteMany({
    where: { id: imageId, product_id: productId },
  });
  return deleted.count > 0;
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<boolean> {
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, product_id: productId },
    select: { id: true },
  });
  if (!image) {
    return false;
  }
  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { product_id: productId, is_primary: true },
      data: { is_primary: false },
    }),
    prisma.productImage.update({ where: { id: imageId }, data: { is_primary: true } }),
  ]);
  return true;
}

export async function listImages(productId: string) {
  return prisma.productImage.findMany({
    where: { product_id: productId },
    orderBy: { sort_order: "asc" },
  });
}

function buildOrderBy(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { name: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { name: "asc" }];
    case "rating":
      return [{ rating: "desc" }, { review_count: "desc" }];
    case "newest":
      return [{ created_at: "desc" }];
    case "popularity":
      return [{ review_count: "desc" }, { rating: "desc" }];
    default:
      return [
        { vendor: { is_sponsored: "desc" } },
        { is_featured: "desc" },
        { rating: "desc" },
        { created_at: "desc" },
      ];
  }
}
