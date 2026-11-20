-- Avisos del linter de Supabase (19/11): funciones con `search_path` fijo.
ALTER FUNCTION public.reject_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.next_code(TEXT, TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.assign_code() SET search_path = public, pg_temp;

-- `rls_auto_enable` la crea Supabase (no está en estas migraciones) como SECURITY DEFINER y
-- ejecutable por cualquiera. Donde exista, solo la usa su disparador de eventos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'rls_auto_enable: sin permiso para revocar, se deja como está';
END $$;
