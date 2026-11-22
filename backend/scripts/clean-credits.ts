import prisma from "../src/database/prisma";

async function main() {
  console.log("\n=======================================================");
  console.log(" 🧹 VEGAMART CLEANING NEGATIVE CREDIT LOGS");
  console.log("=======================================================");

  try {
    const deleted = await prisma.trackingUsageLog.deleteMany({
      where: {
        OR: [
          { credits: { lt: 0 }, type: { not: "USAGE" } },
          { credits: -1200 },
        ],
      },
    });

    console.log(`✅ Cleaned up ${deleted.count} negative adjustment log(s) from database.`);
    console.log("Wallet balance remains intact.");
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Cleanup failed:", err?.message || err);
    process.exit(1);
  }
}

main();
