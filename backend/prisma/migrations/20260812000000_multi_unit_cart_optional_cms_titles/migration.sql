-- Allow multiple units (e.g. 250g / 500g / 1kg) of the same product in the cart,
-- each tracked by its own selected_unit.
DROP INDEX IF EXISTS "cart_items_cart_id_product_id_key";
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_selected_unit_key" ON "cart_items"("cart_id", "product_id", "selected_unit");

-- Make hero banner title optional
ALTER TABLE "hero_slides" ALTER COLUMN "title" DROP NOT NULL;

-- CreateTable
CREATE TABLE "video_ads" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200),
    "subtitle" VARCHAR(300),
    "video_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "cta_text" VARCHAR(100) DEFAULT 'Watch 30s Ad',
    "cta_link" VARCHAR(500),
    "display_mode" VARCHAR(30) NOT NULL DEFAULT 'watch_cta',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "video_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_ads_is_active_idx" ON "video_ads"("is_active");
CREATE INDEX "video_ads_sort_order_idx" ON "video_ads"("sort_order");
CREATE INDEX "video_ads_created_at_idx" ON "video_ads"("created_at");
