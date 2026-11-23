-- AlterTable addresses to add map_url and exact_location
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "map_url" VARCHAR(500);
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "exact_location" VARCHAR(500);
