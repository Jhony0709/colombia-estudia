-- Retira la maquinaria de legado.
--
-- Existía para contenido migrado desde LearnDash: `legacyException` permitía publicar una
-- versión que no pasaba la validación de accesibilidad, `convertUntil` era la fecha
-- comprometida de conversión, y `MediaAsset.legacy` marcaba el recurso migrado sin
-- alternativa textual.
--
-- El 18/9 se canceló la importación (PRODUCT_DECISIONS.md): todo el contenido es nuevo y
-- nada publica sin cumplir las reglas. No queda nada que excepcionar.
--
-- No se pierde nada en uso: estas columnas nunca se escribieron desde la aplicación — solo
-- las habría rellenado el importador, que no llegó a existir.

DROP INDEX IF EXISTS "LessonVersion_institutionId_status_convertUntil_idx";
CREATE INDEX IF NOT EXISTS "LessonVersion_institutionId_status_idx"
  ON "LessonVersion" ("institutionId", "status");

ALTER TABLE "LessonVersion" DROP COLUMN IF EXISTS "legacyException";
ALTER TABLE "LessonVersion" DROP COLUMN IF EXISTS "convertUntil";

DROP INDEX IF EXISTS "MediaAsset_institutionId_kind_legacy_idx";
CREATE INDEX IF NOT EXISTS "MediaAsset_institutionId_kind_idx"
  ON "MediaAsset" ("institutionId", "kind");

ALTER TABLE "MediaAsset" DROP COLUMN IF EXISTS "legacy";
