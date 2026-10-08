-- Solicitudes del estudiante (6/10): inscribirse en un curso de pago o habilitar el siguiente
-- componente. Las resuelve operación; se cierran solas cuando lo pedido ocurre.

-- CreateEnum
CREATE TYPE "AccessRequestKind" AS ENUM ('ENROLL', 'UNLOCK');
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" "AccessRequestKind" NOT NULL,
    "cohortId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessRequest_institutionId_status_createdAt_idx" ON "AccessRequest"("institutionId", "status", "createdAt");
CREATE INDEX "AccessRequest_personId_status_idx" ON "AccessRequest"("personId", "status");

-- Una sola solicitud abierta por persona y cosa pedida; pedir otra vez no duplica.
CREATE UNIQUE INDEX "AccessRequest_one_pending_key" ON "AccessRequest"("personId", "kind", "cohortId", "moduleId")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UNLOCK siempre lleva su matrícula; ENROLL nunca (todavía no la hay).
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_enrollment_check"
  CHECK (("kind" = 'UNLOCK') = ("enrollmentId" IS NOT NULL));

-- RLS como el resto del negocio (002-rls.sql): nadie fuera del service_role.
ALTER TABLE "AccessRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "AccessRequest" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "AccessRequest" FOR ALL TO authenticated USING (false);
