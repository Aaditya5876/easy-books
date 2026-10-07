-- Self-serve company creation is capped per user (default 1); a GeoInfosys
-- SUPER_ADMIN raises this manually when a customer buys another school/company.
ALTER TABLE "users" ADD COLUMN "maxCompanies" INTEGER NOT NULL DEFAULT 1;
