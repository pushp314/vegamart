-- Vendor profile: delivery options (checkout selection UI), vendor-level tax rate
-- and the banner/cover images shown on the vendor detail carousel.
ALTER TABLE "vendor_profiles" ADD COLUMN "delivery_options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "vendor_profiles" ADD COLUMN "tax_rate" DECIMAL(5,2);
ALTER TABLE "vendor_profiles" ADD COLUMN "banner_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Delivery partner: per-order charges configured by the rider, independent of the
-- vendor's delivery fee.
ALTER TABLE "delivery_profiles" ADD COLUMN "base_delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "delivery_profiles" ADD COLUMN "fee_per_km" DECIMAL(10,2) NOT NULL DEFAULT 0;