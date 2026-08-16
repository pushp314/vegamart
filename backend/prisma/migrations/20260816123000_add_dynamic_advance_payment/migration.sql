ALTER TABLE "products" ADD COLUMN "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "vendor_profiles" ADD COLUMN "advance_payment_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10;
