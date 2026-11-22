import { trackingCreditService } from "../src/services/tracking-credit.service";

async function main() {
  const args = process.argv.slice(2);
  const rawAmount = args[0];
  const amount = rawAmount ? parseInt(rawAmount, 10) : 1200;

  if (isNaN(amount) || amount <= 0) {
    console.error("❌ Invalid credit amount. Usage: npm run credits:add <amount> (e.g. npm run credits:add 1200)");
    process.exit(1);
  }

  const reason = args.slice(1).join(" ") || "Developer Credit Recharge";

  console.log("\n=======================================================");
  console.log(" 💳 VEGAMART TRACKING CREDIT RECHARGE");
  console.log("=======================================================");
  console.log(`Adding ${amount.toLocaleString()} credits to platform wallet...\n`);

  try {
    const result = await trackingCreditService.addCredits(amount, reason);

    console.log("✅ Recharge Successful!");
    console.log(`• Previous Balance   : ${result.previousBalance.toLocaleString()} Credits`);
    console.log(`• Credits Added      : +${result.amountAdded.toLocaleString()} Credits`);
    console.log(`• New Balance        : ${result.newBalance.toLocaleString()} Credits`);
    console.log(`• Outstanding Dues   : ₹${result.duesAmount.toFixed(2)}`);
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Recharge Failed:", err?.message || err);
    process.exit(1);
  }
}

main();
