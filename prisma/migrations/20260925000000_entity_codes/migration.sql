-- 25/9: códigos legibles por entidad (pedido de Jhonny: «un ID como en Basikon con
-- registration: el código y un secuencial»). Un contador por institución y entidad, y un
-- trigger BEFORE INSERT que asigna el código cuando la fila llega sin él. En la base y no en
-- el servicio porque una persona la crean el registro, el import, los scripts y el seed: un
-- camino que se olvide de pedir el código dejaría filas sin él.
--
-- Formato: PREFIJO-0001 (relleno a 4, crece sin cortar: PER-10000). Las filas existentes se
-- numeran por fecha de creación (los componentes, por programa y posición) y el contador queda
-- en el último número usado.

-- CreateTable
CREATE TABLE "Counter" (
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("institutionId","name")
);

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Siguiente código de una entidad en una institución. INSERT … ON CONFLICT hace el
-- incremento atómico: dos altas a la vez nunca reciben el mismo número.
CREATE OR REPLACE FUNCTION public.next_code(p_institution TEXT, p_name TEXT, p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO "Counter" ("institutionId", "name", "seq", "updatedAt")
  VALUES (p_institution, p_name, 1, now())
  ON CONFLICT ("institutionId", "name")
  DO UPDATE SET "seq" = "Counter"."seq" + 1, "updatedAt" = now()
  RETURNING "seq" INTO v_seq;

  RETURN p_prefix || '-' || lpad(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- El trigger: TG_ARGV[0] es el prefijo; el nombre del contador es el de la tabla.
CREATE OR REPLACE FUNCTION public.assign_code() RETURNS trigger AS $$
BEGIN
  IF NEW."code" IS NULL OR NEW."code" = '' THEN
    NEW."code" := public.next_code(NEW."institutionId", TG_TABLE_NAME, TG_ARGV[0]);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AlterTable: la columna, sin restricción todavía para poder numerar lo que ya existe.
ALTER TABLE "Person" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Module" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lesson" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Assessment" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';

-- Numerar lo existente.
WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "institutionId" ORDER BY "createdAt", "id") AS n
  FROM "Person"
)
UPDATE "Person" p SET "code" = 'PER-' || lpad(numbered.n::text, 4, '0')
FROM numbered WHERE p."id" = numbered."id";

WITH numbered AS (
  SELECT m."id", row_number() OVER (PARTITION BY m."institutionId" ORDER BY pr."code", m."position", m."id") AS n
  FROM "Module" m JOIN "Program" pr ON pr."id" = m."programId"
)
UPDATE "Module" m SET "code" = 'COM-' || lpad(numbered.n::text, 4, '0')
FROM numbered WHERE m."id" = numbered."id";

WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "institutionId" ORDER BY "createdAt", "id") AS n
  FROM "Lesson"
)
UPDATE "Lesson" l SET "code" = 'TEM-' || lpad(numbered.n::text, 4, '0')
FROM numbered WHERE l."id" = numbered."id";

WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "institutionId" ORDER BY "createdAt", "id") AS n
  FROM "Assessment"
)
UPDATE "Assessment" a SET "code" = 'EXA-' || lpad(numbered.n::text, 4, '0')
FROM numbered WHERE a."id" = numbered."id";

-- Los contadores arrancan donde terminó la numeración.
INSERT INTO "Counter" ("institutionId", "name", "seq", "updatedAt")
SELECT "institutionId", 'Person', count(*), now() FROM "Person" GROUP BY "institutionId"
ON CONFLICT ("institutionId", "name") DO UPDATE SET "seq" = EXCLUDED."seq";
INSERT INTO "Counter" ("institutionId", "name", "seq", "updatedAt")
SELECT "institutionId", 'Module', count(*), now() FROM "Module" GROUP BY "institutionId"
ON CONFLICT ("institutionId", "name") DO UPDATE SET "seq" = EXCLUDED."seq";
INSERT INTO "Counter" ("institutionId", "name", "seq", "updatedAt")
SELECT "institutionId", 'Lesson', count(*), now() FROM "Lesson" GROUP BY "institutionId"
ON CONFLICT ("institutionId", "name") DO UPDATE SET "seq" = EXCLUDED."seq";
INSERT INTO "Counter" ("institutionId", "name", "seq", "updatedAt")
SELECT "institutionId", 'Assessment', count(*), now() FROM "Assessment" GROUP BY "institutionId"
ON CONFLICT ("institutionId", "name") DO UPDATE SET "seq" = EXCLUDED."seq";

-- CreateIndex
CREATE UNIQUE INDEX "Person_institutionId_code_key" ON "Person"("institutionId", "code");
CREATE UNIQUE INDEX "Module_institutionId_code_key" ON "Module"("institutionId", "code");
CREATE UNIQUE INDEX "Lesson_institutionId_code_key" ON "Lesson"("institutionId", "code");
CREATE UNIQUE INDEX "Assessment_institutionId_code_key" ON "Assessment"("institutionId", "code");

-- Triggers
CREATE TRIGGER "Person_assign_code" BEFORE INSERT ON "Person"
  FOR EACH ROW EXECUTE FUNCTION public.assign_code('PER');
CREATE TRIGGER "Module_assign_code" BEFORE INSERT ON "Module"
  FOR EACH ROW EXECUTE FUNCTION public.assign_code('COM');
CREATE TRIGGER "Lesson_assign_code" BEFORE INSERT ON "Lesson"
  FOR EACH ROW EXECUTE FUNCTION public.assign_code('TEM');
CREATE TRIGGER "Assessment_assign_code" BEFORE INSERT ON "Assessment"
  FOR EACH ROW EXECUTE FUNCTION public.assign_code('EXA');

-- El rol de la aplicación tiene que poder incrementar el contador (el trigger corre como
-- quien inserta). Las tablas nuevas ya lo heredan por ALTER DEFAULT PRIVILEGES (19/9); esto es
-- por si esa migración no se aplicó en algún entorno.
GRANT SELECT, INSERT, UPDATE ON TABLE "Counter" TO app_writer;
