-- La verificación en dos pasos del personal pasa a ser un ajuste de la institución (29/9).
-- Por defecto sigue exigida, como hasta ahora.
ALTER TABLE "Institution" ADD COLUMN "requireStaffMfa" BOOLEAN NOT NULL DEFAULT true;
