-- DropIndex
DROP INDEX "audit_logs_action_created_at_idx";

-- DropIndex
DROP INDEX "notifications_user_id_created_at_idx";

-- DropIndex
DROP INDEX "order_items_order_id_created_at_idx";

-- DropIndex
DROP INDEX "orders_payment_status_idx";

-- DropIndex
DROP INDEX "orders_vendor_status_idx";

-- DropIndex
DROP INDEX "payments_razorpay_payment_id_idx";

-- DropIndex
DROP INDEX "products_category_id_is_active_idx";

-- DropIndex
DROP INDEX "products_vendor_id_created_at_idx";

-- DropIndex
DROP INDEX "refresh_tokens_user_id_revoked_at_idx";

-- DropIndex
DROP INDEX "sessions_user_id_is_active_idx";

-- DropIndex
DROP INDEX "vendor_profiles_status_rating_idx";

-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN     "membership_expires_at" TIMESTAMP(3),
ADD COLUMN     "membership_tier" VARCHAR(50) NOT NULL DEFAULT 'basic';
