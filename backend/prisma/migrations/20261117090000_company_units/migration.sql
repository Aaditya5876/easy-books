-- Per-company unit list (empty = the business type's defaults).
ALTER TABLE "companies" ADD COLUMN "units" TEXT[] DEFAULT ARRAY[]::TEXT[];
