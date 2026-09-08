-- Restructure roles: LIBRARIAN is no longer a separate login role — it
-- becomes STAFF tagged with the new 'LIBRARY' staff tag (see
-- core/modules/staff-tags.ts). staffTags also carries HOSTEL/TRANSPORT/HR
-- assignments for other STAFF members, all empty by default.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "staffTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill BEFORE the enum swap below — a row still holding 'LIBRARIAN' at
-- that point would fail the cast to the new enum (which drops the value).
UPDATE "users" SET "staffTags" = ARRAY['LIBRARY']::TEXT[] WHERE "role" = 'LIBRARIAN';
UPDATE "users" SET "role" = 'STAFF' WHERE "role" = 'LIBRARIAN';

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STAFF';
COMMIT;
