-- Backfill: QR was always either a bank settlement or an unsettled wallet
-- balance mislabeled as one enum value — every existing QR row predates that
-- distinction, so the safest backfill is to treat them as WALLET.
UPDATE "transactions" SET "type" = 'WALLET' WHERE "type" = 'QR';

-- Postgres has no direct "DROP VALUE" for enums — recreate the type without QR.
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
CREATE TYPE "TransactionType" AS ENUM ('CASH', 'BANK', 'WALLET', 'CHEQUE', 'CREDIT');
ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "TransactionType" USING ("type"::text::"TransactionType");
DROP TYPE "TransactionType_old";
