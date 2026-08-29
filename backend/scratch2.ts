import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const where: any = {};
  where.NOT = {
    status: "PENDING",
    payment_method: "RAZORPAY",
    payment_status: "PENDING",
  };
  const allOrders = await prisma.order.findMany();
  const withNot = await prisma.order.findMany({ where });
  const missing = allOrders.filter(o1 => !withNot.find(o2 => o1.id === o2.id));
  console.log(missing.map(o => ({ status: o.status, pm: o.payment_method, ps: o.payment_status })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
