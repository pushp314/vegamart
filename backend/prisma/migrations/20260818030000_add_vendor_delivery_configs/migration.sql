-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "delivery_configs" JSONB DEFAULT '{}'::jsonb;
