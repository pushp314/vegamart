-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN IF NOT EXISTS "estimated_delivery_time" VARCHAR(50) DEFAULT '20-30 mins';
