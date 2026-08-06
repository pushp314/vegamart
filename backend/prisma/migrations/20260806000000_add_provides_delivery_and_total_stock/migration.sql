-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN     "provides_delivery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "total_stock" INTEGER NOT NULL DEFAULT 0;
