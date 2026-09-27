-- La congelación pasa a ser de la cohorte, no del contenido (27/9): al publicar, las
-- asignaciones no fijadas siguen a la versión nueva. Lo existente nace sin fijar.
ALTER TABLE "LessonAssignment" ADD COLUMN "pinnedVersion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssessmentAssignment" ADD COLUMN "pinnedVersion" BOOLEAN NOT NULL DEFAULT false;
