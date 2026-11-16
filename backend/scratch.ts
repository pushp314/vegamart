import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { payment_method: 'RAZORPAY' },
        { master_order: { payment_method: 'RAZORPAY' } }
      ]
    },
    select: {
      id: true,
      order_number: true,
      status: true,
      payment_status: true,
      payment_method: true,
      vendor_id: true,
      master_order: {
        select: {
          id: true,
          status: true,
          payment_status: true,
          payment_method: true,
          payment: true
        }
      },
      payment: true
    }
  });
  console.log("All RAZORPAY orders and master:", JSON.stringify(orders, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
