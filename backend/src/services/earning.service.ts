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
  items: Array<{ total_price: number; status: string; category_commission_rate?: number | null }>;
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
 *   commission      = item_revenue * commission_rate / 100 (or category-specific rates per item)
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

  const hasCategoryRates = basis.items.some(
    (i) => typeof i.category_commission_rate === "number" && !isNaN(i.category_commission_rate)
  );

  let totalCommission = 0;
  if (hasCategoryRates && activeSubtotal > 0) {
    for (const item of basis.items) {
      if (item.status === "rejected") continue;
      const itemRatio = item.total_price / activeSubtotal;
      const itemNetRevenue = Math.max(0, item.total_price - discountShare * itemRatio);
      const rate =
        typeof item.category_commission_rate === "number" && !isNaN(item.category_commission_rate)
          ? Math.max(0, item.category_commission_rate)
          : Math.max(0, basis.commission_rate);
      totalCommission += (itemNetRevenue * rate) / 100;
    }
  } else {
    totalCommission = (itemRevenue * Math.max(0, basis.commission_rate)) / 100;
  }

  const commission = round2(totalCommission);
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

  // FLAW 3 FIX: Use createMany + skipDuplicates with a deterministic reference_id
  // so the @@unique([order_id, reference_id]) constraint atomically prevents duplicates.
  // This eliminates the TOCTOU race of the old count-then-create pattern.
  if (net > 0) {
    await db.vendorEarning.createMany({
      data: [
        {
          vendor_id: order.vendor_id,
          order_id: order.id,
          type: "ORDER_COMMISSION",
          amount: net,
          status: "PENDING",
          reference_id: `earning-ORDER_COMMISSION`,
        },
      ],
      skipDuplicates: true,
    });
  }

  if (order.delivery_fee <= 0) return;

  if (order.delivery_partner_id) {
    await db.deliveryEarning.createMany({
      data: [
        {
          delivery_partner_id: order.delivery_partner_id,
          order_id: order.id,
          type: "DELIVERY_FEE",
          amount: round2(order.delivery_fee),
          status: "PENDING",
          reference_id: `earning-DELIVERY_FEE`,
        },
      ],
      skipDuplicates: true,
    });
  } else {
    await db.vendorEarning.createMany({
      data: [
        {
          vendor_id: order.vendor_id,
          order_id: order.id,
          type: "DELIVERY_FEE",
          amount: round2(order.delivery_fee),
          status: "PENDING",
          reference_id: `earning-DELIVERY_FEE`,
        },
      ],
      skipDuplicates: true,
    });
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

    // FLAW 2 FIX: REFUND rows are created as SETTLED immediately so they
    // instantly reduce available balance. This prevents the escrow timing attack
    // where a vendor could withdraw before the refund deduction kicks in.
    await db.vendorEarning.createMany({
      data: [
        {
          vendor_id: order.vendor_id,
          order_id: order.id,
          type: "REFUND",
          amount: -delta,
          status: "SETTLED",
          settled_at: new Date(),
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

    // FLAW 2 FIX: Delivery REFUND rows also settle immediately.
    await db.deliveryEarning.createMany({
      data: [
        {
          delivery_partner_id: order.delivery_partner_id,
          order_id: order.id,
          type: "REFUND",
          amount: -delta,
          status: "SETTLED",
          settled_at: new Date(),
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
  /** Vendor commission rate % applied. */
  commission_rate: number;
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
        select: {
          order_number: true,
          items_subtotal: true,
          discount: true,
          delivery_fee: true,
          tax: true,
          vendor: { select: { commission_rate: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const orderRevenue = round2(row.order.items_subtotal.toNumber() - row.order.discount.toNumber());
    const totalAmount = round2(
      orderRevenue + row.order.delivery_fee.toNumber() + row.order.tax.toNumber()
    );
    const isRefund = row.type === "REFUND";
    const commissionAmount = isRefund ? 0 : round2(Math.max(0, orderRevenue - row.amount.toNumber()));
    const vendorRate = row.order.vendor?.commission_rate?.toNumber();
    const commissionRate = isRefund
      ? 0
      : vendorRate !== undefined
        ? vendorRate
        : orderRevenue > 0
          ? round2((commissionAmount / orderRevenue) * 100)
          : 0;

    return {
      id: row.id,
      created_at: row.created_at,
      type: row.type,
      amount: row.amount.toNumber(),
      status: row.status,
      order_number: row.order.order_number,
      order_revenue: orderRevenue,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      commission_rate: commissionRate,
      vendor_earning: row.amount.toNumber(),
    };
  });
}

/**
 * Releases escrow earnings past the dispute/return hold period (default 24h)
 * transitioning them from PENDING to SETTLED.
 */
export async function releaseEscrowEarnings(
  holdHours = 24,
  db: DbClient = prisma
): Promise<{ releasedVendorEarnings: number; releasedDeliveryEarnings: number }> {
  const cutoff = new Date(Date.now() - holdHours * 60 * 60 * 1000);

  // FLAW 2 FIX: Exclude REFUND rows — they are already SETTLED on creation.
  // Only release positive earnings (ORDER_COMMISSION, DELIVERY_FEE, TIP, BONUS).
  const vendorRes = await db.vendorEarning.updateMany({
    where: {
      status: "PENDING",
      type: { not: "REFUND" },
      created_at: { lte: cutoff },
    },
    data: {
      status: "SETTLED",
      settled_at: new Date(),
    },
  });

  const deliveryRes = await db.deliveryEarning.updateMany({
    where: {
      status: "PENDING",
      type: { not: "REFUND" },
      created_at: { lte: cutoff },
    },
    data: {
      status: "SETTLED",
      settled_at: new Date(),
    },
  });

  return {
    releasedVendorEarnings: vendorRes.count,
    releasedDeliveryEarnings: deliveryRes.count,
  };
}