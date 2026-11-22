import { trackingCreditService } from "../src/services/tracking-credit.service";

async function main() {
  const args = process.argv.slice(2);
  const rawTarget = args[0];
  const target = rawTarget !== undefined ? parseInt(rawTarget, 10) : 1200;

  if (isNaN(target) || target < 0) {
    console.error("❌ Invalid target balance. Usage: npm run credits:set <exact_balance> (e.g. npm run credits:set 1200)");
    process.exit(1);
  }

  const reason = args.slice(1).join(" ") || "Developer Balance Correction";

  console.log("\n=======================================================");
  console.log(" 🎯 VEGAMART SET EXACT TRACKING CREDIT BALANCE");
  console.log("=======================================================");
  console.log(`Setting wallet balance directly to ${target.toLocaleString()} credits...\n`);

  try {
    const result = await trackingCreditService.setBalance(target, reason);

    console.log("✅ Balance Update Successful!");
    console.log(`• Previous Balance   : ${result.previousBalance.toLocaleString()} Credits`);
    console.log(`• New Set Balance    : ${result.newBalance.toLocaleString()} Credits`);
    console.log(`• Net Adjustment     : ${result.diff > 0 ? `+${result.diff.toLocaleString()}` : result.diff.toLocaleString()} Credits`);
    console.log(`• Outstanding Dues   : ₹${result.duesAmount.toFixed(2)}`);
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Balance Update Failed:", err?.message || err);
    process.exit(1);
  }
}

main();
