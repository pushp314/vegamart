/**
 * Backfill script for the earnings ledger.
 *
 * Prior to the earnings feature, delivered orders never produced VendorEarning or
 * DeliveryEarning records, so historical dashboards report zero payouts. This
 * script replays the same immutable ledger creation the delivery lifecycle now
 * performs, for orders that were already complete before the feature shipped.
 *
 * Explicit + idempotent:
 *  - Only DELIVERED orders, and REFUNDED orders that were actually delivered
 *    (delivered_at set), are considered. CANCELLED/FAILED orders and refunded
 *    orders that were never delivered never earned anything and are skipped.
 *  - `createOrderEarnings` skips any earning type that already exists for the
 *    order, so re-running the script is a no-op for already-processed orders.
 *  - Refund reversals are anchored on the gateway refund id (or a stable
 *    synthetic id for legacy refunds without one), so re-running is idempotent.
 *
 * Run explicitly (it is NOT part of the normal boot path):
 *   npm run backfill:earnings
 *
 * It does not alter order/payment data — it only writes the missing ledger rows.
 */
/* eslint-disable no-console */
import prisma from "../database/prisma";
import { createOrderEarnings, reverseOrderEarnings, type OrderEarningInput } from "../services/earning.service";

async function main(): Promise<void> {
  const orders = await prisma.order.findMany({
    where: {
      deleted_at: null,
      OR: [{ status: "DELIVERED" }, { status: "REFUNDED", delivered_at: { not: null } }],
    },
    include: {
      items: { select: { total_price: true, status: true } },
      vendor: { select: { commission_rate: true } },
    },
    orderBy: { created_at: "asc" },
  });

  let earningsCreated = 0;
  let reversalsWritten = 0;

  for (const order of orders) {
    const basis: OrderEarningInput = {
      id: order.id,
      vendor_id: order.vendor_id,
      delivery_partner_id: order.delivery_partner_id,
      items_subtotal: order.items_subtotal.toNumber(),
      delivery_fee: order.delivery_fee.toNumber(),
      discount: order.discount.toNumber(),
      commission_rate: order.vendor?.commission_rate.toNumber() ?? 0,
      items: order.items.map((item) => ({ total_price: item.total_price.toNumber(), status: item.status })),
    };

    const vendorEarningsBefore = await prisma.vendorEarning.count({
      where: { order_id: order.id, type: { in: ["ORDER_COMMISSION", "DELIVERY_FEE"] } },
    });
    const deliveryBefore = order.delivery_partner_id
      ? await prisma.deliveryEarning.count({ where: { order_id: order.id, type: "DELIVERY_FEE" } })
      : 0;

    await createOrderEarnings(basis, prisma);

    const vendorEarningsAfter = await prisma.vendorEarning.count({
      where: { order_id: order.id, type: { in: ["ORDER_COMMISSION", "DELIVERY_FEE"] } },
    });
    const deliveryAfter = order.delivery_partner_id
      ? await prisma.deliveryEarning.count({ where: { order_id: order.id, type: "DELIVERY_FEE" } })
      : 0;
    earningsCreated += vendorEarningsAfter - vendorEarningsBefore + (deliveryAfter - deliveryBefore);

    const partiallyOrFullyRefunded =
      order.payment_status === "REFUNDED" || order.payment_status === "PARTIALLY_REFUNDED";
    if (partiallyOrFullyRefunded) {
      const payment = await prisma.payment.findFirst({
        where: { order_id: order.id },
        select: { refund_id: true, refund_amount: true, amount: true },
      });
      const refundAmount = payment?.refund_amount?.toNumber() ?? 0;
      const paidAmount = payment?.amount.toNumber() ?? order.total.toNumber();
      if (refundAmount > 0 && paidAmount > 0) {
        const referenceId = payment?.refund_id ?? `backfill:refund:${order.id}`;
        await reverseOrderEarnings(
          { id: order.id, vendor_id: order.vendor_id, delivery_partner_id: order.delivery_partner_id, total: paidAmount },
          refundAmount / paidAmount,
          referenceId,
          prisma
        );
        reversalsWritten += 1;
      }
    }
  }

  console.log(`Backfill finished. Earnings rows written: ${earningsCreated}. Refund reversals written: ${reversalsWritten}.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });