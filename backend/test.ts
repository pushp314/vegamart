import { PrismaClient } from '@prisma/client';
import { listOrders } from './src/repositories/order.repository';

const prisma = new PrismaClient();
async function main() {
  try {
    const result = await listOrders({ userId: "c129ffd5-2763-4828-8a0b-e5f1da2f8659" }, 0, 20);
    console.log(result);
  } catch (e) {
    console.error("PRISMA ERROR:", e);
  }
}
main();
