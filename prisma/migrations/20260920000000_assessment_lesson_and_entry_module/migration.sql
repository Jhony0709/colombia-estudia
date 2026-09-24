-- Redefinición del 20/9 (docs/plan-redefinicion-2009.md, Fase A):
-- examen por tema y grado de entrada por matrícula. Sin datos que migrar.

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "lessonId" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "startsAtModule" INTEGER;

-- CreateIndex
CREATE INDEX "Assessment_lessonId_idx" ON "Assessment"("lessonId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
