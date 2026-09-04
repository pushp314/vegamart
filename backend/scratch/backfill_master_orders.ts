import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function mapStatus(orderStatus: string) {
  switch (orderStatus) {
    case "PENDING": return "PENDING";
    case "CONFIRMED":
    case "PREPARING":
    case "PACKED":
    case "READY_FOR_PICKUP": return "ACCEPTED";
    case "OUT_FOR_DELIVERY": return "OUT_FOR_DELIVERY";
    case "DELIVERED": return "DELIVERED";
    case "CANCELLED": return "CANCELLED";
    case "REFUNDED": return "REFUNDED";
    case "FAILED": return "FAILED";
    default: return "PENDING";
  }
}

async function main() {
  const legacyOrders = await prisma.order.findMany({
    where: { master_order_id: null },
    include: { items: true, transactions: true }
  });

  for (const order of legacyOrders) {
    try {
      const masterOrder = await prisma.masterOrder.create({
        data: {
          order_number: `MO_${order.order_number}`,
          user_id: order.user_id,
          status: mapStatus(order.status) as any,
          total_amount: order.total,
          delivery_fee: order.delivery_fee,
          tax: order.tax,
          platform_fee: 0,
          additional_charges: [],
          payment_method: order.payment_method as any,
          payment_status: order.payment_status as any,
          address_id: order.address_id,
          created_at: order.created_at,
          updated_at: order.updated_at,
        }
      });
      
      await prisma.order.update({
        where: { id: order.id },
        data: { master_order_id: masterOrder.id }
      });
      
      console.log(`Successfully backfilled MasterOrder for order ${order.order_number}`);
    } catch (e) {
      console.error(`Failed to backfill order ${order.order_number}:`, e);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
