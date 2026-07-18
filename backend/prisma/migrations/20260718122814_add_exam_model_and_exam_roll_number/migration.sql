-- AlterTable
ALTER TABLE "exam_results" ADD COLUMN     "examId" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "examRollNumber" TEXT;

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exams_companyId_name_key" ON "exams"("companyId", "name");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
