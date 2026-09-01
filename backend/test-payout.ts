import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const agg = await (prisma as any).payoutRequest.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    });
    console.log(agg);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
