-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACCESS_SUSPENDED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCESS_RESTORED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_RENEWAL_REQUESTED';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "accessBlockedNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastRenewalRequestedAt" TIMESTAMP(3);
