-- Reset de datos conservando las personas y sus cuentas (24/9, pedido de Jhonny).
--
-- Se conserva: Institution (con settings.introCohortId a NULL, porque la cohorte deja de
-- existir), Person, Membership, Guardianship, Consent, Invitation y RestrictionPolicy
-- (configuración de la institución). auth.users de Supabase no se toca: vive en otro esquema.
--
-- Se borra todo lo demás: programas, componentes, asignaturas, temas y sus versiones,
-- exámenes, cohortes, matrículas, avance, entregas, intentos, notas, cartera, sesiones en
-- vivo, constancias, aliados, media, eventos, notificaciones, auditoría e importaciones.
-- `TRUNCATE … CASCADE` vacía también cualquier tabla que apunte a estas; ninguna de las
-- conservadas apunta a las borradas salvo Institution.settings (JSON, sin FK).
--
-- Los archivos de Supabase Storage (videos, PDFs, entregas) NO se borran con esto: quedan
-- huérfanos en el bucket; límpialos desde el panel de Storage si hace falta.
--
-- Uso: psql "$DATABASE_URL" -f prisma/scripts/reset-datos-sin-usuarios.sql

BEGIN;

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
  "MediaAsset"
CASCADE;

-- La cohorte de introducción ya no existe: el registro público crea la cuenta sin matrícula
-- hasta que se designe otra.
UPDATE "Institution"
SET "settings" = COALESCE("settings", '{}'::jsonb) - 'introCohortId';

COMMIT;

-- Comprobación rápida (opcional):
-- SELECT (SELECT count(*) FROM "Person") AS personas,
--        (SELECT count(*) FROM "Membership") AS membresias,
--        (SELECT count(*) FROM "Program") AS programas,
--        (SELECT count(*) FROM "Cohort") AS cohortes;
