-- AlterEnum
-- Postgres won't let a newly-added enum value be used in the same transaction
-- it was added in, so this is split into two migrations: add WALLET here,
-- backfill + drop QR in the next one.
ALTER TYPE "TransactionType" ADD VALUE 'WALLET';
