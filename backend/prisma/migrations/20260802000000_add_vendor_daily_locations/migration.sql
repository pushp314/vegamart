-- CreateTable
CREATE TABLE "vendor_daily_locations" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "broadcast_date" DATE NOT NULL,
    "area" VARCHAR(200) NOT NULL,
    "landmark" VARCHAR(200),
    "address" VARCHAR(400) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "start_time" VARCHAR(10),
    "end_time" VARCHAR(10),
    "notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_daily_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_daily_locations_vendor_id_broadcast_date_key" ON "vendor_daily_locations"("vendor_id", "broadcast_date");

-- CreateIndex
CREATE INDEX "vendor_daily_locations_broadcast_date_idx" ON "vendor_daily_locations"("broadcast_date");

-- CreateIndex
CREATE INDEX "vendor_daily_locations_latitude_longitude_idx" ON "vendor_daily_locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "vendor_daily_locations_is_active_broadcast_date_idx" ON "vendor_daily_locations"("is_active", "broadcast_date");

-- AddForeignKey
ALTER TABLE "vendor_daily_locations" ADD CONSTRAINT "vendor_daily_locations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
