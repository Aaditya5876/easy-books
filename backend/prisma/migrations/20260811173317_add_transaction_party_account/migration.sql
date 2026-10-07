-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "partyAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_partyAccountId_fkey" FOREIGN KEY ("partyAccountId") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
