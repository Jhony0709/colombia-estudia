-- 24/9: la actividad con enunciados. El estudiante responde pregunta por pregunta en la
-- plataforma (pedido de los clientes: «que no tengan que escribir en otro lado y subir un PDF»).
-- Sin datos que migrar: las actividades existentes siguen con un solo texto.

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "activityPrompts" JSONB;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "answers" JSONB;
