-- 25/9, fase de negocio 3: «gratis» deja de vivir en un JSON.
-- `Program.pricing` dice si un programa cobra; `Institution.introCohortId` es una columna con
-- FK (antes `settings.introCohortId`, un campo cuyo propio comentario decía «nada de negocio
-- crítico aquí» y que decidía matrícula automática y si un menor entra sin acudiente).

-- CreateEnum
CREATE TYPE "ProgramPricing" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN "pricing" "ProgramPricing" NOT NULL DEFAULT 'PAID';
ALTER TABLE "Institution" ADD COLUMN "introCohortId" TEXT;

-- Migrar el dato del JSON a la columna, solo si la cohorte existe todavía.
UPDATE "Institution" i
SET "introCohortId" = i."settings"->>'introCohortId'
WHERE i."settings" ? 'introCohortId'
  AND EXISTS (SELECT 1 FROM "Cohort" c WHERE c."id" = i."settings"->>'introCohortId');

UPDATE "Institution"
SET "settings" = "settings" - 'introCohortId'
WHERE "settings" ? 'introCohortId';

-- El programa de la cohorte de introducción es, por definición del negocio, el gratuito.
UPDATE "Program" p
SET "pricing" = 'FREE'
FROM "Institution" i
JOIN "Cohort" c ON c."id" = i."introCohortId"
WHERE p."id" = c."programId";

-- CreateIndex
CREATE UNIQUE INDEX "Institution_introCohortId_key" ON "Institution"("introCohortId");

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_introCohortId_fkey" FOREIGN KEY ("introCohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
