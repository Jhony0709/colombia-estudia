-- Rol de aplicación sin UPDATE/DELETE sobre las tablas append-only (plan/10 §3, plan/04).
--
-- `LearningEvent` y `AuditLog` son el rastro: lo que el estudiante hizo y lo que el equipo
-- decidió. Un bug o una credencial filtrada no deben poder reescribirlos. La aplicación se
-- conecta con `app_writer`; el `postgres` de Supabase queda para migraciones y soporte.
--
-- Cómo se aplica (lo hace Jhonny, no CI): en Supabase, SQL Editor como `postgres`. La
-- contraseña se pone aparte (`ALTER ROLE app_writer PASSWORD '…'`) y `DATABASE_URL` de la
-- app pasa a usar ese rol. Prisma Migrate sigue corriendo como `postgres`.
--
-- Idempotente: se puede repetir.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_writer') THEN
    CREATE ROLE app_writer LOGIN NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_writer;

-- Lo append-only: se quita lo que no debe tener.
REVOKE UPDATE, DELETE ON TABLE "LearningEvent" FROM app_writer;
REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM app_writer;

-- Cinturón además de tirantes: un trigger que rechaza UPDATE/DELETE venga de quien venga
-- (salvo el propietario, para migraciones). Así ni `postgres` por descuido las toca.
CREATE OR REPLACE FUNCTION public.reject_mutation() RETURNS trigger AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Tabla append-only: % no admite %', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS learning_event_append_only ON "LearningEvent";
CREATE TRIGGER learning_event_append_only
  BEFORE UPDATE OR DELETE ON "LearningEvent"
  FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();

DROP TRIGGER IF EXISTS audit_log_append_only ON "AuditLog";
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
