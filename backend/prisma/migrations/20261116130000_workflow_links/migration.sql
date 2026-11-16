-- Workflow "connected flow": every record created for a job remembers it,
-- and the job remembers which client/vendor/employee it is for.

ALTER TABLE "tasks"
  ADD COLUMN "assignedEmployeeId" TEXT,
  ADD COLUMN "partyId" TEXT;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedEmployeeId_fkey"
  FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotations" ADD COLUMN "taskId" TEXT;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "quotations_taskId_idx" ON "quotations"("taskId");

ALTER TABLE "sales_orders" ADD COLUMN "taskId" TEXT;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "sales_orders_taskId_idx" ON "sales_orders"("taskId");

ALTER TABLE "purchase_orders" ADD COLUMN "taskId" TEXT;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "purchase_orders_taskId_idx" ON "purchase_orders"("taskId");

ALTER TABLE "clients" ADD COLUMN "taskId" TEXT;
ALTER TABLE "clients" ADD CONSTRAINT "clients_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendors" ADD COLUMN "taskId" TEXT;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees" ADD COLUMN "taskId" TEXT;
ALTER TABLE "employees" ADD CONSTRAINT "employees_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
