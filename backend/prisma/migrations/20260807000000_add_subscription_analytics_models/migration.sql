-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "selected_unit" VARCHAR(50);

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "created_by_vendor_id" UUID;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "selected_unit" VARCHAR(50);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "variants" JSONB;

-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN     "free_delivery_min_order" DECIMAL(10,2),
ADD COLUMN     "is_sponsored" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membership_plan_id" UUID,
ALTER COLUMN "business_hours" SET DATA TYPE VARCHAR(100);

-- CreateTable
CREATE TABLE "vendor_membership_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billing_period" VARCHAR(20) NOT NULL DEFAULT 'monthly',
    "features" JSONB NOT NULL DEFAULT '[]',
    "product_limit" INTEGER NOT NULL DEFAULT 20,
    "daily_order_limit" INTEGER NOT NULL DEFAULT 5,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "includes_sponsorship" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_reviews" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(120),
    "comment" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vendor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_subscriptions" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "previous_plan_id" UUID,
    "new_plan_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "payment_method" VARCHAR(50),
    "transaction_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "banner_url" VARCHAR(255),
    "discount" DECIMAL(10,2) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_analytics" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "store_views" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_analytics" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_analytics" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "new_customers" INTEGER NOT NULL DEFAULT 0,
    "repeat_customers" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_order_counters" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_order_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_membership_plans_slug_key" ON "vendor_membership_plans"("slug");

-- CreateIndex
CREATE INDEX "vendor_membership_plans_is_active_idx" ON "vendor_membership_plans"("is_active");

-- CreateIndex
CREATE INDEX "vendor_reviews_vendor_id_idx" ON "vendor_reviews"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_reviews_user_id_idx" ON "vendor_reviews"("user_id");

-- CreateIndex
CREATE INDEX "vendor_reviews_rating_idx" ON "vendor_reviews"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_subscriptions_vendor_id_key" ON "vendor_subscriptions"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_subscriptions_status_idx" ON "vendor_subscriptions"("status");

-- CreateIndex
CREATE INDEX "vendor_subscriptions_expires_at_idx" ON "vendor_subscriptions"("expires_at");

-- CreateIndex
CREATE INDEX "subscription_history_subscription_id_idx" ON "subscription_history"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_payments_subscription_id_idx" ON "subscription_payments"("subscription_id");

-- CreateIndex
CREATE INDEX "promotions_vendor_id_idx" ON "promotions"("vendor_id");

-- CreateIndex
CREATE INDEX "promotions_is_active_starts_at_ends_at_idx" ON "promotions"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_analytics_vendor_id_date_key" ON "store_analytics"("vendor_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "product_analytics_product_id_date_key" ON "product_analytics"("product_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "customer_analytics_vendor_id_date_key" ON "customer_analytics"("vendor_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_order_counters_vendor_id_date_key" ON "daily_order_counters"("vendor_id", "date");

-- CreateIndex
CREATE INDEX "vendor_profiles_membership_plan_id_idx" ON "vendor_profiles"("membership_plan_id");

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_membership_plan_id_fkey" FOREIGN KEY ("membership_plan_id") REFERENCES "vendor_membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_vendor_id_fkey" FOREIGN KEY ("created_by_vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "vendor_membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_analytics" ADD CONSTRAINT "store_analytics_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_analytics" ADD CONSTRAINT "product_analytics_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_analytics" ADD CONSTRAINT "customer_analytics_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_order_counters" ADD CONSTRAINT "daily_order_counters_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

