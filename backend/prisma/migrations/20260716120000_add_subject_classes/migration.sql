-- AlterTable
ALTER TABLE "subjects" ADD COLUMN "bookReference" TEXT,
ADD COLUMN "chapters" INTEGER;

-- CreateTable
CREATE TABLE "subject_classes" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_classes_subjectId_classId_key" ON "subject_classes"("subjectId", "classId");

-- AddForeignKey
ALTER TABLE "subject_classes" ADD CONSTRAINT "subject_classes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_classes" ADD CONSTRAINT "subject_classes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
