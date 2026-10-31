-- Vista de estudiante (31/10): la matrícula de prueba de un administrador. Queda fuera de
-- listados, conteos, cartera, constancias y avisos al personal; se reinicia desde la vista.

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false;
