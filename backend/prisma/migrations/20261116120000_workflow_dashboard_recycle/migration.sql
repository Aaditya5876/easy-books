-- Communication/Workflow offer an "Urgent" priority.
ALTER TYPE "TaskPriority" ADD VALUE IF NOT EXISTS 'URGENT';

-- Workflow job cards: per-company task numbers and job details.
ALTER TABLE "tasks"
  ADD COLUMN "taskNumber" INTEGER,
  ADD COLUMN "workflowType" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "category" TEXT,
  ADD COLUMN "assignedName" TEXT,
  ADD COLUMN "assignedContact" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "partyType" TEXT,
  ADD COLUMN "partyName" TEXT,
  ADD COLUMN "partyContact" TEXT,
  ADD COLUMN "dueTime" TEXT,
  ADD COLUMN "assignedBy" TEXT;

-- Number existing tasks in creation order, per company.
UPDATE "tasks" t SET "taskNumber" = n.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", id) AS rn FROM "tasks") n
WHERE t.id = n.id;

CREATE UNIQUE INDEX "tasks_companyId_taskNumber_key" ON "tasks"("companyId", "taskNumber");

-- Fixed / variable tag on expense accounts; common fixed costs pre-tagged.
ALTER TABLE "ledger_accounts" ADD COLUMN "costBehavior" TEXT;
UPDATE "ledger_accounts"
SET "costBehavior" = CASE
  -- Same rule as defaultCostBehavior() in @easy-books/shared (\m = word start).
  WHEN "accountName" ~* '\m(rent|salar|wage|insurance|internet|telephone|phone|loan|interest|emi\M|depreciation|ssf|subscription|licen[cs]e|audit|security)'
    THEN 'FIXED'
  ELSE 'VARIABLE'
END
WHERE "accountType" = 'EXPENSE';

-- Recycle bin auto-delete, stored per company (was per browser).
ALTER TABLE "companies" ADD COLUMN "recycleBinRetentionDays" INTEGER;
