-- Item details the Inventory form already asked for but couldn't save
-- (expiry, alert days, supplier), plus batch number and custom item fields.
ALTER TABLE "inventory_items"
  ADD COLUMN "batchNo" TEXT,
  ADD COLUMN "expiryDate" TIMESTAMP(3),
  ADD COLUMN "expiryAlertDays" INTEGER,
  ADD COLUMN "supplierName" TEXT,
  ADD COLUMN "customFields" JSONB;

ALTER TABLE "companies" ADD COLUMN "itemFields" JSONB;
