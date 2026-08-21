-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PayoutRequestStatus" AS ENUM ('pending', 'processing', 'completed', 'rejected', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "payout_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payout_mode" VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
    "account_number" VARCHAR(50),
    "ifsc_code" VARCHAR(20),
    "account_holder" VARCHAR(160),
    "bank_name" VARCHAR(100),
    "upi_id" VARCHAR(100),
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'pending',
    "utr_reference" VARCHAR(120),
    "notes" VARCHAR(500),
    "admin_notes" VARCHAR(500),
    "processed_by" UUID,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_requests_vendor_id_status_idx" ON "payout_requests"("vendor_id", "status");
CREATE INDEX IF NOT EXISTS "payout_requests_status_idx" ON "payout_requests"("status");
CREATE INDEX IF NOT EXISTS "payout_requests_created_at_idx" ON "payout_requests"("created_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
