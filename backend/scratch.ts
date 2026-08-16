import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    const data: any = {
      discount: 0,
      tax: 0,
      total: 15.6,
      invoice_number: "INV-12345",
      otp_code: "123456",
      otp_expires_at: new Date(),
    };
    await prisma.order.update({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      data,
    });
  } catch (err: any) {
    console.log("PRISMA ERROR:", err.message.substring(0, 500));
  }
}
main();
