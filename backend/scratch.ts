import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const filter = { vendorId: "dummy" }; // I will just copy the where logic
  const where: any = { deleted_at: null };
  // where.vendor_id = filter.vendorId;
  where.NOT = {
    status: "PENDING",
    payment_method: "RAZORPAY",
    payment_status: "PENDING",
  };
  
  const orders = await prisma.order.findMany({
    where,
    select: { order_number: true, payment_method: true, status: true, payment_status: true }
  });
  console.log(orders);
}
main().catch(console.error).finally(() => prisma.$disconnect());
