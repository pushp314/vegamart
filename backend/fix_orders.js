const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.order.updateMany({
    where: { 
      status: "PENDING", 
      payment_method: "RAZORPAY",
      payment_status: "PENDING"
    },
    data: {
      payment_method: "COD"
    }
  });
  console.log(`Successfully fixed ${result.count} bugged COD orders!`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
