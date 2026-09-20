# Runbook — Rotación de secretos

Cada secreto, dónde vive, cómo se rota y qué se rompe si se hace mal. Ensayar una vez en
staging antes de salir (plan/10 §3).

| Secreto                     | Dónde se usa                                                | Cómo se rota                                                                                  | Ventana                                             |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `SUPABASE_SECRET_KEY`       | Storage firmado, Auth admin (`lib/auth/supabase-server.ts`) | Supabase → API → generar nueva; poner en Vercel; redeploy; revocar la vieja                   | Segundos: la vieja sigue valiendo hasta revocarla   |
| `DATABASE_URL` (contraseña) | Prisma                                                      | `ALTER ROLE app_writer PASSWORD '…'`; poner en Vercel; redeploy                               | Conexiones nuevas fallan entre el ALTER y el deploy |
| `WOMPI_PRIVATE_KEY`         | `lib/billing/wompi.ts` (consultar transacción)              | Panel de Wompi → llaves → regenerar; poner en Vercel; redeploy                                | La conciliación del job falla hasta el deploy       |
| `WOMPI_EVENTS_SECRET`       | webhook (`verifyEventChecksum`)                             | Panel de Wompi → eventos → regenerar; poner en Vercel; redeploy                               | Eventos entre medio → 401; Wompi reintenta          |
| `WOMPI_INTEGRITY_SECRET`    | checkout (`buildCheckoutUrl`)                               | Igual; los checkouts abiertos con la firma vieja fallan al pagar                              | Avisar: «si ya abriste el pago, vuelve a pulsar»    |
| `RESEND_API_KEY`            | correo (`lib/mail`)                                         | Resend → API keys → nueva; poner en Vercel; redeploy; borrar la vieja                         | Ninguna                                             |
| `CRON_SECRET`               | `POST /api/jobs/daily`                                      | Generar (`openssl rand -hex 32`); poner en Vercel (el cron de Vercel la manda solo); redeploy | Ninguna                                             |

## Orden seguro

1. Generar la nueva **sin revocar la vieja**.
2. Ponerla en Vercel (staging primero).
3. Redeploy.
4. Probar la ruta que la usa (tabla).
5. Revocar la vieja.
6. Anotar fecha y quién en `docs/estado.md`.

## Si se filtró una llave

Revocar primero, preguntar después. Luego el orden de arriba desde el paso 1. Revisar
`AuditLog` y los logs de Vercel de las últimas 24 h buscando lo que esa llave permite
(Storage: descargas; Auth: usuarios creados; Wompi: nada, las llaves privadas no mueven
dinero por sí solas).
