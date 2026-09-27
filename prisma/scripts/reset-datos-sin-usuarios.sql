-- Reset de datos conservando las personas y sus cuentas (24/9, pedido de Jhonny).
--
-- Se conserva: Institution (con introCohortId a NULL, porque la cohorte deja de
-- existir), Person, Membership, Guardianship, Consent, Invitation y RestrictionPolicy
-- (configuración de la institución). auth.users de Supabase no se toca: vive en otro esquema.
--
-- Se borra todo lo demás: programas, componentes, asignaturas, temas y sus versiones,
-- exámenes, cohortes, matrículas, avance, entregas, intentos, notas, cartera, sesiones en
-- vivo, constancias, aliados, media, eventos, notificaciones, auditoría e importaciones.
-- Sin `CASCADE` (25/9): TRUNCATE falla si falta una tabla que apunte a estas; de las
-- conservadas solo Institution apunta a una borrada (introCohortId → Cohort), y se suelta antes.
--
-- Los archivos de Supabase Storage (videos, PDFs, entregas) NO se borran con esto: quedan
-- huérfanos en el bucket; límpialos desde el panel de Storage si hace falta.
--
-- Uso: psql "$DATABASE_URL" -f prisma/scripts/reset-datos-sin-usuarios.sql

BEGIN;

-- Desde el 25/9 `Institution.introCohortId` apunta a "Cohort" (fase de negocio 3). Con
-- `CASCADE`, TRUNCATE vaciaría también "Institution" —todas las tablas que referencian a
-- las vaciadas, tengan datos o no—, así que la referencia se suelta ANTES y sin `CASCADE`:
-- la lista de abajo tiene que ser completa (Postgres avisa si falta alguna).
UPDATE "Institution" SET "introCohortId" = NULL;

TRUNCATE TABLE
  "AuditLog",
  "Notification",
  "LearningEvent",
  "ImportRun",
  "Certificate",
  "Submission",
  "Score",
  "Attempt",
  "LessonProgress",
  "Accommodation",
  "Payment",
  "Installment",
  "PaymentAgreement",
  "PaymentPlan",
  "LiveSession",
  "AssessmentAssignment",
  "LessonAssignment",
  "Enrollment",
  "Cohort",
  "LessonVersionAsset",
  "LessonVersion",
  "AssessmentVersion",
  "Assessment",
  "Lesson",
  "Module",
  "Program",
  "Subject",
  "Partner",
  "MediaAsset",
  "ProgramPrice";

-- Los códigos legibles (25/9) vuelven a empezar para lo que se vació; las personas se
-- conservan y su contador también.
UPDATE "Counter" SET "seq" = 0 WHERE "name" IN ('Module', 'Lesson', 'Assessment');

-- La cohorte de introducción ya no existe (columna puesta a NULL arriba): el registro
-- público crea la cuenta sin matrícula hasta que se designe otra.

COMMIT;

-- Comprobación rápida (opcional):
-- SELECT (SELECT count(*) FROM "Person") AS personas,
--        (SELECT count(*) FROM "Membership") AS membresias,
--        (SELECT count(*) FROM "Program") AS programas,
--        (SELECT count(*) FROM "Cohort") AS cohortes;
