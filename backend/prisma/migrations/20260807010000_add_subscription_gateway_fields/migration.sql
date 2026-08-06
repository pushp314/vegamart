-- AlterTable
ALTER TABLE "vendor_subscriptions" ADD COLUMN     "razorpay_subscription_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "razorpay_subscription_id" VARCHAR(64),
ADD COLUMN     "razorpay_payment_id" VARCHAR(64),
ADD COLUMN     "razorpay_signature" VARCHAR(255),
ADD COLUMN     "gateway_response" JSONB,
ADD COLUMN     "failed_reason" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_subscriptions_razorpay_subscription_id_key" ON "vendor_subscriptions"("razorpay_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_razorpay_subscription_id_key" ON "subscription_payments"("razorpay_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_razorpay_payment_id_key" ON "subscription_payments"("razorpay_payment_id");
