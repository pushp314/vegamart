-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'packed';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'picked_up';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'refunded';

-- AlterEnum
ALTER TYPE "CouponType" ADD VALUE 'free_delivery';

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "applies_to_product_ids" VARCHAR(2000),
ADD COLUMN     "applies_to_category_ids" VARCHAR(1000);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "invoice_number" VARCHAR(40),
ADD COLUMN     "prepared_at" TIMESTAMP(3),
ADD COLUMN     "packed_at" TIMESTAMP(3),
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "refund_reason" VARCHAR(255);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "gateway_response" JSONB,
ADD COLUMN     "webhook_events" JSONB;

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'confirmed',
    "note" VARCHAR(500),
    "actor_type" VARCHAR(30),
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoice_number_key" ON "orders"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_order_id_key" ON "coupon_usages"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_coupon_id_user_id_order_id_key" ON "coupon_usages"("coupon_id", "user_id", "order_id");

-- CreateIndex
CREATE INDEX "coupon_usages_user_id_idx" ON "coupon_usages"("user_id");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_idx" ON "coupon_usages"("coupon_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
