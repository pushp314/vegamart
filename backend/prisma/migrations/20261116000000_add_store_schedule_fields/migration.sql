-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "auto_schedule_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "store_schedule" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "manual_override_status" VARCHAR(30);
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "manual_override_until" TIMESTAMPTZ;
