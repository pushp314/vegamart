-- Allow multiple units (e.g. 250g / 500g / 1kg) of the same product in the cart,
-- each tracked by its own selected_unit.
DROP INDEX IF EXISTS "cart_items_cart_id_product_id_key";
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_selected_unit_key" ON "cart_items"("cart_id", "product_id", "selected_unit");

-- Make hero banner title optional
ALTER TABLE "hero_slides" ALTER COLUMN "title" DROP NOT NULL;

-- Make video ad title optional
ALTER TABLE "video_ads" ALTER COLUMN "title" DROP NOT NULL;
