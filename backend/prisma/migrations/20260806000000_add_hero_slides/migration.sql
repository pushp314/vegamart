-- CreateTable
CREATE TABLE "hero_slides" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(300),
    "body" TEXT,
    "image_url" VARCHAR(500),
    "link_url" VARCHAR(500),
    "link_text" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_slides_is_active_idx" ON "hero_slides"("is_active");
CREATE INDEX "hero_slides_sort_order_idx" ON "hero_slides"("sort_order");
CREATE INDEX "hero_slides_created_at_idx" ON "hero_slides"("created_at");