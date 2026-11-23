-- Safe Idempotent Migration: Master Orders, Cash Settlements, and Tracking Credit System

-- Create Enums safely
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MasterOrderStatus') THEN
    CREATE TYPE "MasterOrderStatus" AS ENUM ('pending', 'accepted', 'pickup_in_progress', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'failed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashSettlementStatus') THEN
    CREATE TYPE "CashSettlementStatus" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Alter existing tables safely
ALTER TABLE "delivery_profiles" ADD COLUMN IF NOT EXISTS "max_cash_in_hand" DECIMAL(10,2) NOT NULL DEFAULT 3000;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "master_order_id" UUID;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "master_order_id" UUID;
ALTER TABLE "payments" ALTER COLUMN "order_id" DROP NOT NULL;

-- Create master_orders table
CREATE TABLE IF NOT EXISTS "master_orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(40) NOT NULL,
    "user_id" UUID NOT NULL,
    "delivery_partner_id" UUID,
    "address_id" UUID NOT NULL,
    "status" "MasterOrderStatus" NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "additional_charges" JSONB,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'razorpay',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_orders_pkey" PRIMARY KEY ("id")
);

-- Create delivery_cash_settlements table
CREATE TABLE IF NOT EXISTS "delivery_cash_settlements" (
    "id" UUID NOT NULL,
    "delivery_partner_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" VARCHAR(50) NOT NULL DEFAULT 'UPI',
    "reference_id" VARCHAR(120),
    "proof_url" VARCHAR(500),
    "notes" VARCHAR(500),
    "status" "CashSettlementStatus" NOT NULL DEFAULT 'pending',
    "admin_notes" VARCHAR(500),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_cash_settlements_pkey" PRIMARY KEY ("id")
);

-- Create tracking_credit_wallets table
CREATE TABLE IF NOT EXISTS "tracking_credit_wallets" (
    "id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 1200,
    "total_used" INTEGER NOT NULL DEFAULT 0,
    "total_recharged" INTEGER NOT NULL DEFAULT 1200,
    "cost_per_track" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "dues_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_credit_wallets_pkey" PRIMARY KEY ("id")
);

-- Create tracking_usage_logs table
CREATE TABLE IF NOT EXISTS "tracking_usage_logs" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL DEFAULT 'USAGE',
    "credits" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "dues_after" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "order_id" UUID,
    "order_number" VARCHAR(50),
    "customer_name" VARCHAR(120),
    "customer_phone" VARCHAR(30),
    "customer_address" TEXT,
    "rider_name" VARCHAR(120),
    "vendor_names" TEXT,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_usage_logs_pkey" PRIMARY KEY ("id")
);

-- Create UserSubscription table
CREATE TABLE IF NOT EXISTS "UserSubscription" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- Indexes safely created
CREATE UNIQUE INDEX IF NOT EXISTS "master_orders_order_number_key" ON "master_orders"("order_number");
CREATE INDEX IF NOT EXISTS "master_orders_user_id_idx" ON "master_orders"("user_id");
CREATE INDEX IF NOT EXISTS "master_orders_delivery_partner_id_idx" ON "master_orders"("delivery_partner_id");
CREATE INDEX IF NOT EXISTS "delivery_cash_settlements_delivery_partner_id_status_idx" ON "delivery_cash_settlements"("delivery_partner_id", "status");
CREATE INDEX IF NOT EXISTS "delivery_cash_settlements_status_idx" ON "delivery_cash_settlements"("status");
CREATE INDEX IF NOT EXISTS "delivery_cash_settlements_created_at_idx" ON "delivery_cash_settlements"("created_at");
CREATE INDEX IF NOT EXISTS "tracking_usage_logs_wallet_id_idx" ON "tracking_usage_logs"("wallet_id");
CREATE INDEX IF NOT EXISTS "tracking_usage_logs_order_id_idx" ON "tracking_usage_logs"("order_id");
CREATE INDEX IF NOT EXISTS "tracking_usage_logs_created_at_idx" ON "tracking_usage_logs"("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "UserSubscription_user_id_vendor_id_key" ON "UserSubscription"("user_id", "vendor_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_master_order_id_key" ON "payments"("master_order_id");

-- Foreign Keys safely added
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_orders_user_id_fkey') THEN
    ALTER TABLE "master_orders" ADD CONSTRAINT "master_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_orders_delivery_partner_id_fkey') THEN
    ALTER TABLE "master_orders" ADD CONSTRAINT "master_orders_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_orders_address_id_fkey') THEN
    ALTER TABLE "master_orders" ADD CONSTRAINT "master_orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_master_order_id_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_master_order_id_fkey" FOREIGN KEY ("master_order_id") REFERENCES "master_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_master_order_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_master_order_id_fkey" FOREIGN KEY ("master_order_id") REFERENCES "master_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_cash_settlements_delivery_partner_id_fkey') THEN
    ALTER TABLE "delivery_cash_settlements" ADD CONSTRAINT "delivery_cash_settlements_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracking_usage_logs_wallet_id_fkey') THEN
    ALTER TABLE "tracking_usage_logs" ADD CONSTRAINT "tracking_usage_logs_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "tracking_credit_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSubscription_user_id_fkey') THEN
    ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSubscription_vendor_id_fkey') THEN
    ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
