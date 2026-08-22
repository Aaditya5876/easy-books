-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
