-- Spaces: rooms, tables, beds, chairs — sessions and their charges.
-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "SpaceRateUnit" AS ENUM ('NIGHT', 'DAY', 'HOUR', 'VISIT');

-- CreateEnum
CREATE TYPE "SpaceSessionStatus" AS ENUM ('RESERVED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER,
    "rate" DECIMAL(12,2),
    "rateUnit" "SpaceRateUnit",
    "status" "SpaceStatus" NOT NULL DEFAULT 'FREE',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "status" "SpaceSessionStatus" NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestContact" TEXT,
    "guests" INTEGER,
    "reservedFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "expectedEnd" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "salesOrderId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_charges" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "inventoryItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spaces_companyId_name_key" ON "spaces"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "space_sessions_salesOrderId_key" ON "space_sessions"("salesOrderId");

-- CreateIndex
CREATE INDEX "space_sessions_companyId_status_idx" ON "space_sessions"("companyId", "status");

-- CreateIndex
CREATE INDEX "space_sessions_spaceId_idx" ON "space_sessions"("spaceId");

-- CreateIndex
CREATE INDEX "space_charges_sessionId_idx" ON "space_charges"("sessionId");

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_sessions" ADD CONSTRAINT "space_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_sessions" ADD CONSTRAINT "space_sessions_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_sessions" ADD CONSTRAINT "space_sessions_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_charges" ADD CONSTRAINT "space_charges_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "space_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
