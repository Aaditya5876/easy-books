-- CreateEnum
CREATE TYPE "FeePaymentStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "fee_payments" ADD COLUMN     "proofScreenshotUrl" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "status" "FeePaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "submittedByPortal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationCode" TEXT,
ALTER COLUMN "receiptNo" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_verificationCode_key" ON "fee_payments"("verificationCode");

