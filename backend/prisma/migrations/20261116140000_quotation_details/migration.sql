-- The Quotations page collected these but there was nowhere to store them,
-- so they were silently dropped (and lost on conversion to a bill).
ALTER TABLE "quotations"
  ADD COLUMN "clientContact" TEXT,
  ADD COLUMN "clientAddress" TEXT,
  ADD COLUMN "clientPanVat" TEXT,
  ADD COLUMN "validUntil" TIMESTAMP(3),
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "laborItems" JSONB;
