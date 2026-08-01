-- Phase 7: Performance & security hardening
-- Adds password history tracking, performance indexes and cache-friendly constraints.

-- Password history & change tracking
ALTER TABLE "users"
  ADD COLUMN "password_history" JSONB,
  ADD COLUMN "password_changed_at" TIMESTAMP(3);

-- Performance indexes
CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders" ("payment_status");
CREATE INDEX IF NOT EXISTS "orders_vendor_status_idx" ON "orders" ("vendor_id", "status");
CREATE INDEX IF NOT EXISTS "order_items_order_id_created_at_idx" ON "order_items" ("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs" ("action", "created_at");
CREATE INDEX IF NOT EXISTS "products_vendor_id_created_at_idx" ON "products" ("vendor_id", "created_at");
CREATE INDEX IF NOT EXISTS "products_category_id_is_active_idx" ON "products" ("category_id", "is_active");
CREATE INDEX IF NOT EXISTS "sessions_user_id_is_active_idx" ON "sessions" ("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens" ("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "payments_razorpay_payment_id_idx" ON "payments" ("razorpay_payment_id");
CREATE INDEX IF NOT EXISTS "vendor_profiles_status_rating_idx" ON "vendor_profiles" ("status", "rating");
