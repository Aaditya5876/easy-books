-- CreateEnum
CREATE TYPE "CashFlowActivity" AS ENUM ('OPERATING', 'INVESTING', 'FINANCING');

-- AlterTable
ALTER TABLE "ledger_accounts" ADD COLUMN     "cashFlowActivity" "CashFlowActivity";
