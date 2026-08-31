-- CreateEnum
CREATE TYPE "BankAccountPaymentType" AS ENUM ('BANK', 'ESEWA', 'KHALTI');

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "paymentType" "BankAccountPaymentType" NOT NULL DEFAULT 'BANK';

-- Backfill: auto-detect eSewa/Khalti accounts that were only distinguishable
-- by a free-text bankName (e.g. "esewa") before this column existed.
UPDATE "bank_accounts" SET "paymentType" = 'ESEWA' WHERE "bankName" ILIKE '%esewa%';
UPDATE "bank_accounts" SET "paymentType" = 'KHALTI' WHERE "bankName" ILIKE '%khalti%';
