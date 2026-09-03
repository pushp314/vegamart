import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const dp = await prisma.deliveryProfile.findFirst();
  console.log("Delivery Profile:", dp);
}
main().finally(() => prisma.$disconnect());
