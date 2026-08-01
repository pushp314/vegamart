import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  product_id: true,
  created_at: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      unit: true,
      price: true,
      mrp: true,
      is_active: true,
      is_available: true,
      vendor_id: true,
      images: {
        select: { id: true, url: true, alt_text: true, sort_order: true, is_primary: true },
        orderBy: { sort_order: "asc" as const },
      },
    },
  },
} as const;

export type WishlistRow = {
  id: string;
  product_id: string;
  created_at: Date;
  product: {
    id: string;
    name: string;
    slug: string;
    unit: string;
    price: import("@prisma/client").Prisma.Decimal;
    mrp: import("@prisma/client").Prisma.Decimal;
    is_active: boolean;
    is_available: boolean;
    vendor_id: string;
    images: Array<{
      id: string;
      url: string;
      alt_text: string | null;
      sort_order: number;
      is_primary: boolean;
    }>;
  };
};

export async function listByUser(userId: string): Promise<WishlistRow[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { user_id: userId },
    select: baseSelect,
    orderBy: { created_at: "desc" },
  });
  return rows as unknown as WishlistRow[];
}

export async function findByUserAndProduct(userId: string, productId: string) {
  return prisma.wishlistItem.findUnique({
    where: { user_id_product_id: { user_id: userId, product_id: productId } },
    select: { id: true },
  });
}

export async function add(userId: string, productId: string): Promise<WishlistRow> {
  const row = await prisma.wishlistItem.create({
    data: { user_id: userId, product_id: productId },
    select: baseSelect,
  });
  return row as unknown as WishlistRow;
}

export async function remove(userId: string, productId: string): Promise<boolean> {
  const deleted = await prisma.wishlistItem.deleteMany({
    where: { user_id: userId, product_id: productId },
  });
  return deleted.count > 0;
}

export async function countByUser(userId: string): Promise<number> {
  return prisma.wishlistItem.count({ where: { user_id: userId } });
}
