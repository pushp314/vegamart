-- CreateTable
CREATE TABLE "checkout_idempotencies" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "user_id" UUID NOT NULL,
    "request_hash" VARCHAR(128),
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_idempotencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_idempotencies_idempotency_key_key" ON "checkout_idempotencies"("idempotency_key");

-- CreateIndex
CREATE INDEX "checkout_idempotencies_user_id_idx" ON "checkout_idempotencies"("user_id");

-- AddForeignKey
ALTER TABLE "checkout_idempotencies" ADD CONSTRAINT "checkout_idempotencies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;