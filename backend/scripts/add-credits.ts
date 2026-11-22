import { trackingCreditService } from "../src/services/tracking-credit.service";

async function main() {
  const args = process.argv.slice(2);
  const rawAmount = args[0];
  const amount = rawAmount ? parseInt(rawAmount, 10) : 1200;

  if (isNaN(amount) || amount === 0) {
    console.error("❌ Invalid credit amount. Usage: npm run credits:add <amount> (e.g. npm run credits:add 1200 or npm run credits:add -- -1200)");
    process.exit(1);
  }

  const reason = args.slice(1).join(" ") || (amount > 0 ? "Developer Credit Recharge" : "Developer Credit Correction");

  console.log("\n=======================================================");
  console.log(" 💳 VEGAMART TRACKING CREDIT RECHARGE / ADJUSTMENT");
  console.log("=======================================================");
  console.log(`Applying adjustment of ${amount > 0 ? `+${amount.toLocaleString()}` : amount.toLocaleString()} credits to wallet...\n`);

  try {
    const result = await trackingCreditService.addCredits(amount, reason);

    console.log("✅ Operation Successful!");
    console.log(`• Previous Balance   : ${result.previousBalance.toLocaleString()} Credits`);
    console.log(`• Credits Added/Adj  : ${amount > 0 ? `+${result.amountAdded.toLocaleString()}` : result.amountAdded.toLocaleString()} Credits`);
    console.log(`• New Balance        : ${result.newBalance.toLocaleString()} Credits`);
    console.log(`• Outstanding Dues   : ₹${result.duesAmount.toFixed(2)} (${result.newBalance < 0 ? Math.abs(result.newBalance) : 0} Credits)`);
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Operation Failed:", err?.message || err);
    process.exit(1);
  }
}

main();
