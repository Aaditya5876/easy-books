-- Admin-set/bulk-generated portal passwords are known to staff, so the
-- account must be forced to change it on first login.
ALTER TABLE "portal_users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
