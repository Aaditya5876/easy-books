ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "verificationOtp" TEXT;
ALTER TABLE "users" ADD COLUMN "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather existing users: they were created without email verification, mark them as verified
UPDATE "users" SET "emailVerified" = true;
