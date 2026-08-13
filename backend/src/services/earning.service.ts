import type { Prisma, PrismaClient } from "@prisma/client";

import prisma from "../database/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Minimal data needed to derive an order's earnings. `items` values are the
 * persisted OrderItem prices (unit_price * quantity) and `items_subtotal` is the
 * order's gross line total before discount/tax/delivery. `commission_rate` is the
 * vendor's effective rate percent (VendorProfile.commission_rate, synced from the
 * membership plan when one is active).
 */
export interface OrderEarningInput {
  id: string;
  vendor_id: string;
  delivery_partner_id: string | null;
  items_subtotal: number;
  delivery_fee: number;
  discount: number;
  commission_rate: number;
  items: Array<{ total_price: number; status: string }>;
}

export interface RefundEarningInput {
  id: string;
  vendor_id: string;
  delivery_partner_id: string | null;
}

export interface VendorEarningBreakdown {
  /** Gross line value of accepted (non-rejected) items, after discount share. */
  item_revenue: number;
  /** Platform commission on item revenue. */
  commission: number;
  /** Vendor net = item_revenue - commission. */
  net: number;
}

/**
 * Vendor net earning for an order:
 *
 *   activeSubtotal = sum of accepted item line totals (rejected items excluded)
 *   discountShare   = order discount scaled to the accepted-item share
 *   item_revenue    = activeSubtotal - discountShare
 *   commission      = item_revenue * commission_rate / 100
 *   net             = item_revenue - commission
 *
 * Taxes are a platform pass-through (never part of vendor revenue) and the
 * delivery fee is attributed separately (delivery partner, or the vendor on
 * self-delivery) so this value is the authoritative "vendor earning".
 */
export function computeVendorEarning(basis: OrderEarningInput): VendorEarningBreakdown {
  const activeSubtotal = round2(
    basis.items.reduce((sum, item) => (item.status === "rejected" ? sum : sum + item.total_price), 0)
  );
  const ratio = basis.items_subtotal > 0 ? Math.min(1, Math.max(0, activeSubtotal / basis.items_subtotal)) : 1;
  const discountShare = round2(basis.discount * ratio);
  const itemRevenue = round2(Math.max(0, activeSubtotal - discountShare));
  const commission = round2((itemRevenue * Math.max(0, basis.commission_rate)) / 100);
  const net = round2(Math.max(0, itemRevenue - commission));
  return { item_revenue: itemRevenue, commission, net };
}

/**
 * Creates the immutable earning rows for a delivered order exactly once.
 *
 * - Vendor ORDER_COMMISSION earning: the vendor's net on accepted items.
 * - Vendor DELIVERY_FEE earning: the delivery fee earned on self-delivery.
 * - Delivery DELIVERY_FEE earning: the delivery fee earned by the assigned partner.
 *
 * Idempotent: each row type is skipped if a matching earning already exists for
 * the order, so replaying a delivery completion (safe-guarded downstream by the
 * atomic count===0 claim) can never duplicate earnings. Runs inside the caller's
 * transaction where applicable.
 */
export async function createOrderEarnings(order: OrderEarningInput, db: DbClient = prisma): Promise<void> {
  const { net } = computeVendorEarning(order);

  if (net > 0) {
    const existing = await db.vendorEarning.count({
      where: { order_id: order.id, type: "ORDER_COMMISSION" },
    });
    if (existing === 0) {
      await db.vendorEarning.create({
        data: {
          vendor_id: order.vendor_id,
          order_id: order.id,
          type: "ORDER_COMMISSION",
          amount: net,
          status: "PENDING",
        },
      });
    }
  }

  if (order.delivery_fee <= 0) return;

  if (order.delivery_partner_id) {
    const existing = await db.deliveryEarning.count({
      where: { order_id: order.id, type: "DELIVERY_FEE" },
    });
    if (existing === 0) {
      await db.deliveryEarning.create({
        data: {
          delivery_partner_id: order.delivery_partner_id,
          order_id: order.id,
          type: "DELIVERY_FEE",
          amount: round2(order.delivery_fee),
          status: "PENDING",
        },
      });
    }
  } else {
    const existing = await db.vendorEarning.count({
      where: { order_id: order.id, type: "DELIVERY_FEE" },
    });
    if (existing === 0) {
      await db.vendorEarning.create({
        data: {
          vendor_id: order.vendor_id,
          order_id: order.id,
          type: "DELIVERY_FEE",
          amount: round2(order.delivery_fee),
          status: "PENDING",
        },
      });
    }
  }
}

/**
 * Reverses earnings for a refund order by `fraction` (refunded amount / order total).
 *
 * Creates negative REFUND rows anchored on `referenceId` (the gateway refund id).
 * The reversal is incremental: the target reversal is the accepted earnings times
 * the fraction, and only the delta beyond any existing reversal is written. The
 * unique `reference_id` plus `skipDuplicates` makes each refund event idempotent:
 * replayed callbacks with the same reference cannot double-reverse. Cascading
 * partial refunds converge to the correct cumulative reversal.
 *
 * Orders cancelled before delivery never had earning rows, so this is a no-op.
 */
export async function reverseOrderEarnings(
  order: RefundEarningInput & { total: number },
  fraction: number,
  referenceId: string,
  db: DbClient = prisma
): Promise<void> {
  const clamped = Math.min(1, Math.max(0, fraction));

  async function reverseVendorEarnings(): Promise<void> {
    const active = await db.vendorEarning.aggregate({
      where: { order_id: order.id, type: { not: "REFUND" } },
      _sum: { amount: true },
    });
    const positive = active._sum.amount?.toNumber() ?? 0;
    if (positive <= 0) return;

    const refunded = await db.vendorEarning.aggregate({
      where: { order_id: order.id, type: "REFUND" },
      _sum: { amount: true },
    });
    const alreadyReversed = Math.abs(refunded._sum.amount?.toNumber() ?? 0);

    const target = round2(positive * clamped);
    const delta = round2(target - alreadyReversed);
    if (delta <= 0.005) return;

    await db.vendorEarning.createMany({
      data: [
        {
          vendor_id: order.vendor_id,
          order_id: order.id,
          type: "REFUND",
          amount: -delta,
          status: "PENDING",
          reference_id: referenceId,
        },
      ],
      skipDuplicates: true,
    });
  }

  async function reverseDeliveryEarnings(): Promise<void> {
    if (!order.delivery_partner_id) return;

    const active = await db.deliveryEarning.aggregate({
      where: { order_id: order.id, type: { not: "REFUND" } },
      _sum: { amount: true },
    });
    const positive = active._sum.amount?.toNumber() ?? 0;
    if (positive <= 0) return;

    const refunded = await db.deliveryEarning.aggregate({
      where: { order_id: order.id, type: "REFUND" },
      _sum: { amount: true },
    });
    const alreadyReversed = Math.abs(refunded._sum.amount?.toNumber() ?? 0);

    const target = round2(positive * clamped);
    const delta = round2(target - alreadyReversed);
    if (delta <= 0.005) return;

    await db.deliveryEarning.createMany({
      data: [
        {
          delivery_partner_id: order.delivery_partner_id,
          order_id: order.id,
          type: "REFUND",
          amount: -delta,
          status: "PENDING",
          reference_id: referenceId,
        },
      ],
      skipDuplicates: true,
    });
  }

  await reverseVendorEarnings();
  await reverseDeliveryEarnings();
}

export interface VendorEarningRow {
  id: string;
  created_at: Date;
  type: string;
  amount: number;
  status: string;
  order_number: string;
  /** Gross order item revenue after discount (items_subtotal - discount). */
  order_revenue: number;
  /** Customer order total (items_subtotal - discount + delivery_fee + tax). */
  total_amount: number;
  /** Platform commission implied for this order (order_revenue - net). */
  commission_amount: number;
  vendor_earning: number;
}

/** Recent vendor earning ledger rows for the dashboard transactions table. */
export async function listVendorEarningsRecent(
  vendorId: string,
  limit = 12,
  db: DbClient = prisma
): Promise<VendorEarningRow[]> {
  const rows = await db.vendorEarning.findMany({
    where: { vendor_id: vendorId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      order: {
        select: { order_number: true, items_subtotal: true, discount: true, delivery_fee: true, tax: true },
      },
    },
  });

  return rows.map((row) => {
    const orderRevenue = round2(row.order.items_subtotal.toNumber() - row.order.discount.toNumber());
    const totalAmount = round2(
      orderRevenue + row.order.delivery_fee.toNumber() + row.order.tax.toNumber()
    );
    const isRefund = row.type === "REFUND";
    return {
      id: row.id,
      created_at: row.created_at,
      type: row.type,
      amount: row.amount.toNumber(),
      status: row.status,
      order_number: row.order.order_number,
      order_revenue: orderRevenue,
      total_amount: totalAmount,
      commission_amount: isRefund ? 0 : round2(Math.max(0, orderRevenue - row.amount.toNumber())),
      vendor_earning: row.amount.toNumber(),
    };
  });
}