-- Aprobación automática de la actividad (27/9): la entrega queda APPROVED al enviarse.
ALTER TABLE "Lesson" ADD COLUMN "activityAutoApprove" BOOLEAN NOT NULL DEFAULT false;
