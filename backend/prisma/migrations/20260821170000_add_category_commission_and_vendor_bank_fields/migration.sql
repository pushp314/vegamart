-- AlterTable
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "commission_rate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "bank_account_number" VARCHAR(50);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "bank_ifsc" VARCHAR(20);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "bank_account_holder_name" VARCHAR(160);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(100);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "upi_id" VARCHAR(100);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "razorpay_account_id" VARCHAR(100);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "payout_enabled" BOOLEAN NOT NULL DEFAULT true;
