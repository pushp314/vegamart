-- CreateTable
CREATE TABLE "vendor_location_history" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "area" VARCHAR(200) NOT NULL,
    "landmark" VARCHAR(200),
    "address" VARCHAR(400) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "start_time" VARCHAR(10),
    "end_time" VARCHAR(10),
    "notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_followers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nearby_search_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" VARCHAR(200) NOT NULL,
    "category" VARCHAR(120),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_km" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "filters" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nearby_search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_location_history_vendor_id_recorded_at_idx" ON "vendor_location_history"("vendor_id", "recorded_at");

-- CreateIndex
CREATE INDEX "vendor_location_history_latitude_longitude_idx" ON "vendor_location_history"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "customer_favorites_vendor_id_idx" ON "customer_favorites"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_followers_vendor_id_idx" ON "vendor_followers"("vendor_id");

-- CreateIndex
CREATE INDEX "nearby_search_history_user_id_created_at_idx" ON "nearby_search_history"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_favorites_user_id_vendor_id_key" ON "customer_favorites"("user_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_followers_user_id_vendor_id_key" ON "vendor_followers"("user_id", "vendor_id");

-- AddForeignKey
ALTER TABLE "vendor_location_history" ADD CONSTRAINT "vendor_location_history_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_followers" ADD CONSTRAINT "vendor_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_followers" ADD CONSTRAINT "vendor_followers_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nearby_search_history" ADD CONSTRAINT "nearby_search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
