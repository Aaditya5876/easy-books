-- Opening balance a vendor/client carried before being added to the books.
ALTER TABLE "vendors" ADD COLUMN "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
