-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXPIRING';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "expiryReminderDays" INTEGER,
ADD COLUMN     "planStatus" TEXT,
ADD COLUMN     "planTier" TEXT,
ADD COLUMN     "productLine" TEXT,
ADD COLUMN     "subscriptionStartedAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "productLine" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "installationFee" DECIMAL(12,2) NOT NULL,
    "monthly" DECIMAL(12,2) NOT NULL,
    "quarterly" DECIMAL(12,2) NOT NULL,
    "halfYearly" DECIMAL(12,2) NOT NULL,
    "yearly" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_prices_productLine_tier_key" ON "plan_prices"("productLine", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_receiptNumber_key" ON "subscription_payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "subscription_payments_companyId_paidAt_idx" ON "subscription_payments"("companyId", "paidAt");

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
