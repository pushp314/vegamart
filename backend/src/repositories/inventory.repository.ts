import type { Prisma, PrismaClient } from "@prisma/client";

import prisma from "../database/prisma";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

type DbClient = PrismaClient | Prisma.TransactionClient;

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

/**
 * Atomically reserves the requested quantities inside a transaction.
 *
 * For every product the inventory row is ensured to exist (seeded from the
 * product's coarse `stock` when missing) and the reservation is applied with a
 * conditional guard so concurrent checkouts can never over-reserve:
 *
 *   UPDATE ... SET reserved = reserved + qty
 *   WHERE product_id = ? AND quantity - reserved >= qty
 *
 * A product that fails the guard aborts the whole checkout transaction, so no
 * partial reservations are ever persisted. Returns nothing on success and
 * throws `INSUFFICIENT_STOCK` on the first shortfall.
 */
export async function reserveAvailable(
  items: Array<{ product_id: string; quantity: number; name: string }>,
  db: DbClient = prisma
): Promise<void> {
  for (const item of items) {
    await db.$executeRaw`
      INSERT INTO inventory_items (id, product_id, quantity, reserved, low_stock_threshold, location, updated_by, created_at, updated_at)
      SELECT gen_random_uuid(), p.id, p.stock, 0, 5, NULL, NULL, now(), now()
      FROM products p
      WHERE p.id = ${item.product_id}::uuid
      ON CONFLICT (product_id) DO NOTHING
    `;
    const reserved = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory_items
      SET reserved = reserved + ${item.quantity}, updated_at = now()
      WHERE product_id = ${item.product_id}::uuid
        AND quantity - reserved >= ${item.quantity}
      RETURNING id
    `;
    if (reserved.length === 0) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, `Insufficient stock for "${item.name}".`, {
        code: "INSUFFICIENT_STOCK",
      });
    }
  }
}

export async function releaseReserved(productId: string, quantity: number, db: DbClient = prisma): Promise<void> {
  await db.$executeRaw`
    UPDATE inventory_items
    SET reserved = GREATEST(0, reserved - ${quantity}), updated_at = now()
    WHERE product_id = ${productId}::uuid
  `;
}

export async function consumeReserved(productId: string, quantity: number, db: DbClient = prisma): Promise<void> {
  await db.inventoryItem.updateMany({
    where: { product_id: productId, reserved: { gte: quantity } },
    data: {
      reserved: { decrement: quantity },
      quantity: { decrement: quantity },
    },
  });
  await db.product.updateMany({
    where: { id: productId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  await db.product.updateMany({
    where: { id: productId, stock: { lte: 0 } },
    data: { is_available: false },
  });
}

export async function listByOrder(orderId: string, db: DbClient = prisma): Promise<Array<{ product_id: string; quantity: number }>> {
  const rows = await db.orderItem.findMany({
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

/**
 * Releases the reserved stock for every item of an order.
 *
 * Accepts an optional db so it can run inside a transaction (e.g. the atomic
 * CANCELLED claim), keeping the inventory release exactly-once with the status
 * transition. `GREATEST(0, ...)` guarantees reservations can never go negative
 * even if the same order is released twice.
 */
export async function releaseQuantityForOrder(orderId: string, db: DbClient = prisma): Promise<void> {
  const items = await listByOrder(orderId, db);
  for (const item of items) {
    await releaseReserved(item.product_id, item.quantity, db);
  }
}

export async function consumeQuantityForOrder(orderId: string, db: DbClient = prisma): Promise<void> {
  const items = await listByOrder(orderId, db);
  for (const item of items) {
    await consumeReserved(item.product_id, item.quantity, db);
  }
}
