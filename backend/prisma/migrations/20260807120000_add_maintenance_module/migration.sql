-- Remote Maintenance Control Module
-- 1. Single-row SystemSettings table (singleton keyed on a fixed UUID).
-- 2. MaintenanceAuditLog table for developer actions.

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "maintenance_enabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so reads never hit a missing row.
INSERT INTO "system_settings" ("id", "maintenance_enabled", "maintenance_message", "updated_at", "created_at")
VALUES ('00000000-0000-0000-0000-000000000001', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "maintenance_audit_logs" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "developer_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_audit_logs_action_created_at_idx" ON "maintenance_audit_logs"("action", "created_at");
