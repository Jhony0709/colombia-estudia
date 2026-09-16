# ADR 0001: Entornos sin Supabase CLI

## Contexto

Se requiere un entorno de desarrollo local y CI sin depender de Supabase CLI (Docker).
Las llaves legacy `anon`/`service_role` se deprecan a fin de 2026.

## Decisión

1. **Sin Supabase CLI**: desarrollo local contra staging; tests de integración contra
   Postgres plano local; CI con service container `postgres:16`.
2. **Un solo proyecto Supabase** (`colombia-estudia-staging`, Free) hasta que el producto
   esté listo. Producción se crea después con Pro.
3. **Llaves nuevas**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`
   (prefijos `sb_publishable_…` y `sb_secret_…`).

## Consecuencias

- La migración genera los roles `anon`/`authenticated` si faltan (para Postgres plano).
- `deploy.yml` solo migra staging (`DIRECT_URL_STAGING`); añadir prod es agregar
  `DIRECT_URL_PROD` y un `if`.
- Vercel Production y Preview apuntan a staging hasta que exista prod.
- Funciones Pro (leaked-password, time-box, backups) quedan para prod.
