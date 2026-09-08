-- Per-user suspend switch (distinct from Company.isActive) and last-login
-- tracking for the SUPER_ADMIN Clients screen / company Users tab.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
