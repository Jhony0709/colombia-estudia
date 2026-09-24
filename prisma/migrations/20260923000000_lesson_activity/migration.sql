-- Revisión UX del 23/9, pieza 4: la actividad como sección propia del tema.
-- Instrucciones y qué se acepta viven en Lesson (sin versionar, decisión de Jhonny). Sin datos que migrar.

-- CreateEnum
CREATE TYPE "ActivityAccepts" AS ENUM ('TEXT', 'FILE', 'TEXT_OR_FILE');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "activityInstructions" TEXT,
ADD COLUMN "activityAccepts" "ActivityAccepts" NOT NULL DEFAULT 'TEXT_OR_FILE';
