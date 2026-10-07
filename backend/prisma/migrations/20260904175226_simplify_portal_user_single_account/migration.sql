-- One portal account per student (shared by parent and student), instead of
-- separate PARENT/STUDENT accounts. All existing rows are already unique per
-- studentId (all type PARENT), so this is safe.

DROP INDEX "portal_users_studentId_type_key";

ALTER TABLE "portal_users" DROP COLUMN "type";

CREATE UNIQUE INDEX "portal_users_studentId_key" ON "portal_users"("studentId");

DROP TYPE "PortalUserType";
