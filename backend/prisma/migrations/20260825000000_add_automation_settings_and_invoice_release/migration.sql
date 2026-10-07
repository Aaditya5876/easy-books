-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "autoFeeBilling" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoInvoiceRelease" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoPayroll" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoReconciliation" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "fee_invoices" ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- Backfill: invoices created before this migration were already visible/notified
-- in the student portal unconditionally — grandfather them in as released so
-- nothing already-visible disappears once portal.service.ts starts filtering
-- on releasedAt.
UPDATE "fee_invoices" SET "releasedAt" = "createdAt" WHERE "releasedAt" IS NULL;
