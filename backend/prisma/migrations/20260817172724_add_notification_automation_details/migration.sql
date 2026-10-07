-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_AUTOMATION';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "details" JSONB;
