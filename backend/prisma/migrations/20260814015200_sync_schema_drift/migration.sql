-- Add missing columns that were in schema.prisma but absent in previous migrations
ALTER TABLE "video_ads" ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "vendor_profiles" ADD COLUMN "sponsored_until" TIMESTAMP(3);
ALTER TABLE "vendor_profiles" ADD COLUMN "sponsored_priority" INTEGER NOT NULL DEFAULT 0;
