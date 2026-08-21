-- AlterTable
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "bank_account_number" VARCHAR(50);
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "bank_ifsc" VARCHAR(20);
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "bank_account_holder_name" VARCHAR(160);
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(100);
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "upi_id" VARCHAR(100);
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "payout_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "payout_requests" ALTER COLUMN "vendor_id" DROP NOT NULL;
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "delivery_partner_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_requests_delivery_partner_id_status_idx" ON "payout_requests"("delivery_partner_id", "status");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_delivery_partner_id_fkey'
  ) THEN
    ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
