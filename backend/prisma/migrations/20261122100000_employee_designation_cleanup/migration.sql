-- Employee records auto-created for app logins got the login's ROLE as their
-- designation ("ADMIN", "ACCOUNTANT", "STAFF") and a "USER-<uuid>" employee ID.
-- Role is an app permission, not a job title: clear it (HR fills the real
-- title), and give those records normal EMP-#### numbers after each
-- company's highest existing one.

UPDATE "employees"
SET "designation" = NULL
WHERE "employeeId" LIKE 'USER-%'
  AND upper("designation") IN ('ADMIN', 'ACCOUNTANT', 'STAFF', 'SUPER_ADMIN');

WITH base AS (
  SELECT "companyId",
         COALESCE(MAX((substring("employeeId" from '^EMP-([0-9]+)$'))::int), 0) AS mx
  FROM "employees"
  GROUP BY "companyId"
), todo AS (
  SELECT "id", "companyId",
         row_number() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rn
  FROM "employees"
  WHERE "employeeId" LIKE 'USER-%'
)
UPDATE "employees" e
SET "employeeId" = 'EMP-' || lpad((b.mx + t.rn)::text, 4, '0')
FROM todo t
JOIN base b ON b."companyId" = t."companyId"
WHERE e."id" = t."id";
