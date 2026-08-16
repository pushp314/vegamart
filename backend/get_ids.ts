import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    const vendor = await prisma.vendorProfile.findFirst();
    const address = await prisma.address.findFirst();
    const product = await prisma.product.findFirst();

    console.log({
      user: user?.id,
      vendor: vendor?.id,
      address: address?.id,
      product: product?.id,
    });
  } catch (e: any) {
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
