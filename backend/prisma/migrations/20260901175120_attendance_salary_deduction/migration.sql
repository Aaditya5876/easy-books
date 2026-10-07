-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- AlterTable
ALTER TABLE "company_payroll_settings" ADD COLUMN     "attendanceDeductionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "standardEndTime" TEXT,
ADD COLUMN     "standardStartTime" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "contractedHoursPerDay" DECIMAL(4,2),
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME';

-- AlterTable
ALTER TABLE "payrolls" ADD COLUMN     "hoursShortfallDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "incompleteAttendanceDays" INTEGER NOT NULL DEFAULT 0;
