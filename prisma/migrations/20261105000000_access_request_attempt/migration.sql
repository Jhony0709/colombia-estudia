-- Otra oportunidad en un examen (5/11, Kris): quien pierde todos los intentos queda bloqueado
-- hasta que operación le conceda uno más. La solicitud ATTEMPT hecha (DONE) es ese intento.

-- AlterEnum
ALTER TYPE "AccessRequestKind" ADD VALUE 'ATTEMPT';

-- AlterTable
ALTER TABLE "AccessRequest" ADD COLUMN "assessmentAssignmentId" TEXT,
ADD COLUMN "whatsappAt" TIMESTAMP(3),
ADD COLUMN "whatsappId" TEXT;

-- CreateIndex
CREATE INDEX "AccessRequest_enrollmentId_kind_status_idx" ON "AccessRequest"("enrollmentId", "kind", "status");

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_assessmentAssignmentId_fkey" FOREIGN KEY ("assessmentAssignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una abierta por examen: dos exámenes del mismo componente no chocan en el índice.
DROP INDEX "AccessRequest_one_pending_key";
CREATE UNIQUE INDEX "AccessRequest_one_pending_key" ON "AccessRequest"("personId", "kind", "cohortId", "moduleId", COALESCE("assessmentAssignmentId", ''))
  WHERE "status" = 'PENDING';
