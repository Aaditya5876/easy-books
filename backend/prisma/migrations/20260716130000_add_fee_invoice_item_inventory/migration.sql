-- AlterTable
ALTER TABLE "fee_invoice_items" ADD COLUMN "inventoryItemId" TEXT,
ADD COLUMN "quantity" DECIMAL(12,3);

-- AddForeignKey
ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
