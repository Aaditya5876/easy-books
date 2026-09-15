-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXTENDED';

-- AlterTable
ALTER TABLE "companies"
ADD COLUMN "subscriptionExtensionUsedAt" TIMESTAMP(3),
ADD COLUMN "subscriptionExtensionExpiresAt" TIMESTAMP(3);