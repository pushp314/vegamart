import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { payoutService } from './src/services/payout.service';

async function main() {
  try {
    // get a vendor id
    const vendor = await prisma.vendorProfile.findFirst();
    if (!vendor) return console.log("No vendor found");
    const result = await payoutService.getVendorWalletOverview(vendor.id);
    console.log(result);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
