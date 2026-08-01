import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  product_id: true,
  quantity: true,
  reserved: true,
  low_stock_threshold: true,
  location: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
} as const;

export type InventoryRow = {
  id: string;
  product_id: string;
  quantity: number;
  reserved: number;
  low_stock_threshold: number;
  location: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function findByProductId(productId: string): Promise<InventoryRow | null> {
  const row = await prisma.inventoryItem.findUnique({
    where: { product_id: productId },
    select: baseSelect,
  });
  return row as unknown as InventoryRow | null;
}

export async function upsertInventory(data: {
  product_id: string;
  quantity: number;
  low_stock_threshold?: number;
  location?: string | null;
  updated_by?: string | null;
}): Promise<InventoryRow> {
  const row = await prisma.inventoryItem.upsert({
    where: { product_id: data.product_id },
    create: {
      product_id: data.product_id,
      quantity: data.quantity,
      low_stock_threshold: data.low_stock_threshold ?? 5,
      location: data.location ?? null,
      updated_by: data.updated_by ?? null,
    },
    update: {
      quantity: data.quantity,
      ...(data.low_stock_threshold !== undefined ? { low_stock_threshold: data.low_stock_threshold } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      updated_by: data.updated_by ?? null,
    },
    select: baseSelect,
  });
  return row as unknown as InventoryRow;
}

export async function updateInventory(
  productId: string,
  data: Prisma.InventoryItemUpdateInput
): Promise<InventoryRow> {
  const row = await prisma.inventoryItem.update({
    where: { product_id: productId },
    data,
    select: baseSelect,
  });
  return row as unknown as InventoryRow;
}

export async function listByVendor(vendorId: string): Promise<Array<InventoryRow & { product_name: string }>> {
  const rows = await prisma.inventoryItem.findMany({
    where: { product: { vendor_id: vendorId, deleted_at: null } },
    select: {
      ...baseSelect,
      product: { select: { name: true } },
    },
    orderBy: { updated_at: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    quantity: row.quantity,
    reserved: row.reserved,
    low_stock_threshold: row.low_stock_threshold,
    location: row.location,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product_name: row.product.name,
  }));
}

export async function countByVendor(vendorId: string): Promise<number> {
  return prisma.inventoryItem.count({
    where: { product: { vendor_id: vendorId, deleted_at: null } },
  });
}

export async function reserveQuantity(productId: string, quantity: number): Promise<boolean> {
  const result = await prisma.inventoryItem.updateMany({
    where: { product_id: productId, quantity: { gte: quantity } },
    data: { reserved: { increment: quantity } },
  });
  return result.count > 0;
}

export async function releaseReserved(productId: string, quantity: number): Promise<void> {
  await prisma.inventoryItem.updateMany({
    where: { product_id: productId, reserved: { gte: quantity } },
    data: { reserved: { decrement: quantity } },
  });
}

export async function consumeReserved(productId: string, quantity: number): Promise<void> {
  await prisma.inventoryItem.updateMany({
    where: { product_id: productId, reserved: { gte: quantity } },
    data: {
      reserved: { decrement: quantity },
      quantity: { decrement: quantity },
    },
  });
}

export async function listByOrder(orderId: string): Promise<Array<{ product_id: string; quantity: number }>> {
  const rows = await prisma.orderItem.findMany({
    where: { order_id: orderId },
    select: { product_id: true, quantity: true },
  });
  return rows;
}

export async function reserveQuantityFromOrder(orderId: string, _req?: unknown): Promise<void> {
  const items = await listByOrder(orderId);
  for (const item of items) {
    await reserveQuantity(item.product_id, item.quantity);
  }
}

export async function releaseQuantityForOrder(orderId: string): Promise<void> {
  const items = await listByOrder(orderId);
  for (const item of items) {
    await releaseReserved(item.product_id, item.quantity);
  }
}

export async function consumeQuantityForOrder(orderId: string): Promise<void> {
  const items = await listByOrder(orderId);
  for (const item of items) {
    await consumeReserved(item.product_id, item.quantity);
  }
}
