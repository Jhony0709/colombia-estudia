-- RLS en las tres tablas que se quedaron sin ella (auditoría de salida, 31/10): Counter,
-- ProgramPrice y EnrollmentModule. Como el resto (002-rls.sql): nadie fuera del dueño ni del
-- service_role. La app y las migraciones se conectan como el dueño, que no pasa por RLS.

ALTER TABLE "Counter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "Counter" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "Counter" FOR ALL TO authenticated USING (false);

ALTER TABLE "ProgramPrice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "ProgramPrice" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "ProgramPrice" FOR ALL TO authenticated USING (false);

ALTER TABLE "EnrollmentModule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon" ON "EnrollmentModule" FOR ALL TO anon USING (false);
CREATE POLICY "deny_authenticated" ON "EnrollmentModule" FOR ALL TO authenticated USING (false);

-- El contador se toca solo desde el trigger `assign_code`, que corre con el rol de la app.
REVOKE EXECUTE ON FUNCTION public.next_code(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- El historial de Prisma no es de nadie fuera de las migraciones. Sin RLS a propósito: quien
-- migra tiene que poder leerlo; basta con quitar los permisos de la API.
REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
