-- AlterTable: earnings are immutable ledger rows. `reference_id` anchors a
-- reversal row (e.g. a REFUND earning) to the source payment/refund id so that
-- replayed refund events can never create duplicate reversals for the same order.
-- It is NULL for initial order earnings, which are idempotent by their atomic
-- delivery claim.
ALTER TABLE "vendor_earnings" ADD COLUMN "reference_id" VARCHAR(120);

ALTER TABLE "delivery_earnings" ADD COLUMN "reference_id" VARCHAR(120);

-- CreateIndex (scoped per order so cross-order refund ids can never collide)
CREATE UNIQUE INDEX "vendor_earnings_order_id_reference_id_key" ON "vendor_earnings"("order_id", "reference_id");
CREATE UNIQUE INDEX "delivery_earnings_order_id_reference_id_key" ON "delivery_earnings"("order_id", "reference_id");