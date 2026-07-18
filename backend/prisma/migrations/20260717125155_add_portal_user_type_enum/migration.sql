/*
  Warnings:

  - The `type` column on the `portal_users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PortalUserType" AS ENUM ('PARENT', 'STUDENT');

-- AlterTable
ALTER TABLE "portal_users" DROP COLUMN "type",
ADD COLUMN     "type" "PortalUserType" NOT NULL DEFAULT 'PARENT';

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_studentId_type_key" ON "portal_users"("studentId", "type");
