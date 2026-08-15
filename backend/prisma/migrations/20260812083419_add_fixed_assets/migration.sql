-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetCode" TEXT,
    "category" TEXT,
    "purchaseDateAd" TIMESTAMP(3) NOT NULL,
    "purchaseDateBs" TEXT,
    "cost" DECIMAL(14,2) NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "salvageValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "accumulatedDepreciation" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastDepreciationDateAd" TIMESTAMP(3),
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposalDateAd" TIMESTAMP(3),
    "disposalAmount" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
