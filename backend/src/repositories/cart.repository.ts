import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
  items: {
    select: {
      id: true,
      product_id: true,
      quantity: true,
      selected_unit: true,
      price_snapshot: true,
      created_at: true,
      updated_at: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          unit: true,
          price: true,
          mrp: true,
          tax_rate: true,
          is_active: true,
          is_available: true,
          stock: true,
          vendor_id: true,
          category_id: true,
          images: {
            select: { id: true, url: true, alt_text: true, sort_order: true, is_primary: true },
            orderBy: { sort_order: "asc" as const },
          },
        },
      },
    },
    orderBy: { created_at: "asc" as const },
  },
} as const;

export type CartRow = {
  id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    selected_unit: string | null;
    price_snapshot: import("@prisma/client").Prisma.Decimal;
    created_at: Date;
    updated_at: Date;
    product: {
      id: string;
      name: string;
      slug: string;
      unit: string;
      price: import("@prisma/client").Prisma.Decimal;
      mrp: import("@prisma/client").Prisma.Decimal;
      tax_rate: import("@prisma/client").Prisma.Decimal;
      is_active: boolean;
      is_available: boolean;
      stock: number;
      vendor_id: string;
      category_id: string;
      images: Array<{
        id: string;
        url: string;
        alt_text: string | null;
        sort_order: number;
        is_primary: boolean;
      }>;
    };
  }>;
};

function mapRow(row: unknown): CartRow {
  return row as CartRow;
}

export async function findByUserId(userId: string): Promise<CartRow | null> {
  const row = await prisma.cart.findUnique({
    where: { user_id: userId },
    select: baseSelect,
  });
  return row ? mapRow(row) : null;
}

export async function getOrCreate(userId: string): Promise<CartRow> {
  // Single atomic upsert: concurrent calls for a brand-new user can no longer
  // race (find-then-create) and trip the unique(user_id) constraint, leaving one
  // orphaned cart or a 500. The `user_id` unique index serialises them.
  const row = await prisma.cart.upsert({
    where: { user_id: userId },
    update: {},
    create: { user_id: userId },
    select: baseSelect,
  });
  return mapRow(row);
}

export async function addItem(
  cartId: string,
  productId: string,
  quantity: number,
  priceSnapshot: Prisma.Decimal,
  selectedUnit?: string
): Promise<CartRow> {
  const unit = selectedUnit ?? null;
  await prisma.cartItem.upsert({
    where: {
      cart_id_product_id_selected_unit: {
        cart_id: cartId,
        product_id: productId,
        selected_unit: unit ?? "",
      },
    },
    create: {
      cart_id: cartId,
      product_id: productId,
      quantity,
      selected_unit: unit,
      price_snapshot: priceSnapshot,
    },
    update: { quantity: { increment: quantity }, price_snapshot: priceSnapshot },
  });
  const row = await prisma.cart.findUnique({
    where: { id: cartId },
    select: baseSelect,
  });
  return mapRow(row!);
}

export async function setItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartRow | null> {
  const updated = await prisma.cartItem.updateMany({
    where: { id: itemId, cart_id: cartId },
    data: { quantity },
  });
  if (updated.count === 0) {
    return null;
  }
  const row = await prisma.cart.findUnique({
    where: { id: cartId },
    select: baseSelect,
  });
  return row ? mapRow(row) : null;
}

export async function removeItem(cartId: string, itemId: string): Promise<boolean> {
  const deleted = await prisma.cartItem.deleteMany({
    where: { id: itemId, cart_id: cartId },
  });
  return deleted.count > 0;
}

export async function clear(cartId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cart_id: cartId } });
}
