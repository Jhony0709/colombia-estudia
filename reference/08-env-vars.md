# 08 — Variables de entorno

Entornos: `local` (tu máquina, **contra el proyecto Supabase de staging**; sin Supabase CLI),
`staging` (Vercel: Production y Preview mientras no exista producción) y, cuando el producto
esté listo, `prod` (proyecto Supabase Pro aparte). Los tests de integración no usan ninguno de
los tres: corren contra un Postgres plano local o el service container del CI, con las variables
pasadas en la línea de comando. Nada de datos reales fuera de producción. `prisma migrate deploy`
corre en CI sobre `main` antes del deploy, nunca a mano contra un entorno remoto.

| Variable                                | Requerida | Entornos                | Dónde se usa                                                                                                                                                                                     |
| --------------------------------------- | --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                          | Sí        | todos                   | Prisma en runtime: transaction pooler, puerto 6543, `?pgbouncer=true&connection_limit=1`, usuario `prisma.<project-ref>`                                                                         |
| `DIRECT_URL`                            | Sí        | todos                   | `prisma migrate deploy`: session pooler, puerto 5432 (la conexión directa exige IPv6 o el add-on IPv4)                                                                                           |
| `NEXT_PUBLIC_SUPABASE_URL`              | Sí        | todos                   | Cliente Supabase Auth                                                                                                                                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | Sí        | todos                   | Cliente Supabase Auth (llave `sb_publishable_…`, sucesora de `anon`; las llaves JWT `anon`/`service_role` quedan deprecadas a fin de 2026). Mapea al rol `anon`: **RLS deniega todo a este rol** |
| `SUPABASE_SECRET_KEY`                   | Sí        | todos                   | Solo servidor (llave `sb_secret_…`, sucesora de `service_role`; salta RLS y Supabase la rechaza desde un navegador): Storage firmado, invitaciones, anonimización. **Jamás al cliente**          |
| `NEXT_PUBLIC_APP_URL`                   | Sí        | todos                   | URL base para enlaces cuando no hay institución en contexto (verificación de certificados); el tenant se resuelve por `Institution.primaryDomain`                                                |
| `RESEND_API_KEY`                        | Sí        | staging, prod           | Emails. El remitente sale de `Institution.emailFromName` sobre el dominio verificado                                                                                                             |
| `EMAIL_DOMAIN`                          | Sí        | staging, prod           | Dominio verificado en Resend (`colombiaestudia.co`)                                                                                                                                              |
| `VIMEO_ACCESS_TOKEN`                    | Sí        | staging, prod           | Metadatos y pistas de subtítulos al registrar videos                                                                                                                                             |
| `CRON_SECRET`                           | Sí        | staging, prod           | Firma del job diario (`POST /api/jobs/daily`); distinto por entorno                                                                                                                              |
| `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY` | Sí        | staging (sandbox), prod | Checkout y consulta de transacciones                                                                                                                                                             |
| `WOMPI_EVENTS_SECRET`                   | Sí        | staging, prod           | Verificación de la firma del webhook                                                                                                                                                             |
| `SENTRY_DSN`                            | Sí        | staging, prod           | Errores desde el primer handler                                                                                                                                                                  |
| `TZ`                                    | Sí        | todos                   | `America/Bogota`                                                                                                                                                                                 |

`.env.example` lleva todas con placeholder. `.env*` nunca se commitea. El único webhook del MVP es el de Wompi.
