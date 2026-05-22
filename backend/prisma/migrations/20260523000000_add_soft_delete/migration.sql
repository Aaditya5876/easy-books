-- Add soft-delete support to all main entity tables
ALTER TABLE "clients"         ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "vendors"         ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "employees"       ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "inventory_items" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "sales_orders"    ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "tasks"           ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "memo_documents"  ADD COLUMN "deletedAt" TIMESTAMP(3);
