-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "feeInvoiceSequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feeInvoiceYear" TEXT;

-- AlterTable
ALTER TABLE "fee_invoices" ADD COLUMN     "invoiceNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "fee_invoices_companyId_invoiceNo_key" ON "fee_invoices"("companyId", "invoiceNo");
