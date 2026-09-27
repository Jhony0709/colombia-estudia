-- 25/9, fase de negocio 2: qué vende cada programa y el grado escolar de cada componente.
-- Los clientes hablan en grados («desde grado 6 a 8», «9 a 11»); hasta hoy el schema solo
-- conocía posiciones de componente.

-- CreateEnum
CREATE TYPE "ProgramKind" AS ENUM ('BACHILLERATO', 'INGLES', 'TECNICO', 'REFUERZO', 'PRE_ICFES', 'PREGRADO', 'OTRO');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN "kind" "ProgramKind" NOT NULL DEFAULT 'OTRO';
ALTER TABLE "Module" ADD COLUMN "grade" INTEGER;
ALTER TABLE "Enrollment" ADD COLUMN "entryGrade" INTEGER;

-- Un grado escolar es 0 (transición) a 13; lo demás es un error de tipeo.
ALTER TABLE "Module" ADD CONSTRAINT "Module_grade_check" CHECK ("grade" IS NULL OR ("grade" >= 0 AND "grade" <= 13));
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_entryGrade_check" CHECK ("entryGrade" IS NULL OR ("entryGrade" >= 0 AND "entryGrade" <= 13));
