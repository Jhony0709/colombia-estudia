# 04 — Seguridad

## Objetivo

Proteger datos de personas (algunas menores), notas, respuestas correctas y cartera, con
controles que se prueban y no dependen de que alguien se acuerde. Referencia: OWASP ASVS
nivel 2 como lista de comprobación; aquí lo que aplica a esta plataforma.

## Modelo de amenazas (lo que de verdad puede pasar)

| Amenaza                                                              | Quién                            | Control                                                                                                                                                                                |
| -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un estudiante lee temas o notas de otra cohorte o de otro estudiante | Estudiante curioso               | Capacidades con alcance; test "otra cohorte → 403"; ids cuid no adivinables                                                                                                            |
| Fuga de respuestas correctas                                         | Cualquiera con sesión            | `answerKey` aparte + `omit` global + test de no-fuga en `/api/learn/*`; `reviewPolicy`                                                                                                 |
| Datos de una institución vistos por otra                             | Bug de consulta                  | `institutionId` en todas las tablas + cliente extendido + test por tabla; RLS deny-all como red                                                                                        |
| Toma de cuenta de staff (ve cartera y PII)                           | Phishing, contraseña reutilizada | MFA obligatoria para staff; contraseñas filtradas bloqueadas; sesión 12 h; logout revoca                                                                                               |
| Fuerza bruta en login / enumeración de correos                       | Bot                              | Rate limit en WAF; respuestas genéricas; sin CAPTCHA (accesibilidad)                                                                                                                   |
| CSRF en un route handler que muta                                    | Sitio malicioso                  | Cookies `SameSite=Lax`; verificación de `Origin`/`Sec-Fetch-Site` en `apiHandler` para métodos no seguros; Server Actions ya lo hacen                                                  |
| XSS vía contenido de autores                                         | Autor comprometido o descuidado  | Markdown → HTML por nuestro parser (sin HTML crudo) + sanitización (`rehype-sanitize` con esquema propio) + CSP con nonce sin `unsafe-inline`                                          |
| Archivo malicioso subido (SVG con script, HTML como imagen)          | Autor, estudiante (entregas)     | Allowlist de MIME por tipo; **SVG prohibido**; verificación de magic bytes en `confirm`; `Content-Disposition: attachment` para descargas; bucket privado con URLs firmadas de 10 min  |
| Webhook de Wompi falsificado                                         | Atacante que conoce la URL       | Verificación de firma (`WOMPI_EVENTS_SECRET`, checksum de propiedades + timestamp); idempotencia por `gatewayRef`; nunca se confía en el monto del evento sin consultar la transacción |
| Job diario disparado por terceros                                    | Cualquiera con la URL            | `CRON_SECRET` en `Authorization`; solo POST; idempotente                                                                                                                               |
| Lectura de PII por staff sin necesidad                               | Insider                          | Detalle de persona = `AuditLog person.pii_read`; listados sin documento ni fecha de nacimiento                                                                                         |
| Cambio de nota o de ajuste sin rastro                                | Insider, bug                     | `AuditLog` con antes/después en cada mutación sensible; append-only por rol de BD                                                                                                      |
| Pérdida de datos                                                     | Error humano, incidente          | Migraciones por CI con revisión; sin `db push`; backups diarios (Supabase Pro) + restauración ensayada en fase 6                                                                       |
| Dependencia comprometida                                             | Cadena de suministro             | `pnpm` con lockfile congelado; Renovate; `pnpm audit` en CI; sin `postinstall` de terceros sin revisar                                                                                 |
| Secretos en el repo                                                  | Descuido                         | `.env*` ignorado; escaneo de secretos en CI (gitleaks); service role solo en servidor                                                                                                  |

## Cabeceras (en el middleware, para toda respuesta HTML)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
  style-src 'self' 'nonce-{nonce}';
  img-src 'self' data: blob: https://*.supabase.co https://i.vimeocdn.com;
  media-src 'self' https://*.supabase.co;
  frame-src https://player.vimeo.com https://checkout.wompi.co;
  connect-src 'self' https://*.supabase.co https://*.sentry.io;
  font-src 'self';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Next 15 soporta nonces por request; Tailwind con variables CSS no necesita `unsafe-inline`.
KaTeX se sirve desde `self`. La CSP se prueba en CI con una página que la violaría.

## Entrada y salida

- Todo input por Zod en `apiHandler`; ids como cuid; emails normalizados; CSV con límites
  de tamaño (5 MB) y filas (2.000).
- Toda salida por serializadores por rol (`features/*/server/serialize.ts`): nunca se
  devuelve un modelo de Prisma tal cual.
- Errores: `APIError` con `code`; el mensaje al cliente no incluye stack, SQL ni ids
  internos de Supabase. 404 para "no existe" y "no es tuyo".

## Archivos

Subida directa a Storage con URL firmada (`POST /api/media/upload` decide bucket y
ruta `institutions/{id}/{kind}/{cuid}.{ext}`), tamaño máximo por tipo (imagen 10 MB, PDF
50 MB, audio 100 MB, entrega 20 MB), `confirm` descarga la cabecera del objeto y verifica
magic bytes contra la extensión; lo que no coincide se borra y se audita. Servir siempre
por URL firmada corta; nunca bucket público.

## PII y Ley 1581

- Documento, fecha de nacimiento, teléfono, correo: solo en `GET /api/people/[id]` con
  `people.manage`, auditado. Listados y exportaciones sin documento ni fecha de nacimiento
  (la exportación de cartera lleva nombre y estado, no documento).
- Diagnósticos: no existen en la BD; el formulario de `Accommodation.notes` lo advierte y
  un test de contenido (lista de términos) avisa en revisión.
- Anonimización: procedimiento de `schema.md` §"Retención y supresión", con `AuditLog`.
- Logs sin PII (`redact` en pino); Sentry con `beforeSend`.
- Contrato de encargo de tratamiento por institución (`onboarding-institucion.md`).

## Auditoría

`lib/db/audit.ts`: `audit(ctx, { entity, entityId, action, before, after })` dentro de la
misma transacción que la mutación. Acciones del catálogo de `schema.md`. Rol de BD
`app_writer` sin `UPDATE`/`DELETE` sobre `AuditLog` y `LearningEvent` (`prisma/sql/003-grants.sql`).

## Respaldo y recuperación

Supabase Pro: backups diarios, 7 días. Fase 6: restaurar un backup en un proyecto temporal
y verificar conteos; documentar el tiempo que tardó (RTO) en `docs/runbooks/restore.md`.
Storage: versionado del bucket activado.

## Incidentes

`docs/runbooks/incidente.md`: quién decide, cómo se revoca una sesión (Supabase admin),
cómo se rota un secreto (Vercel + Supabase), cómo se pone la plataforma en solo lectura
(flag en `Institution.settings` leído por `apiHandler`), a quién se notifica (la
institución es responsable del tratamiento: Ley 1581 exige avisar a la SIC en incidentes
de datos). Se escribe en fase 6, se ensaya una vez.

## Lo que no hacemos y por qué

Sin CAPTCHA (accesibilidad; el WAF cubre). Sin antivirus de archivos en el MVP (magic
bytes + tipos restringidos + sin ejecución de nada subido); se revisa si aparecen
entregas en formatos ejecutables. Sin cifrado de columnas en el MVP: Supabase cifra en
reposo; el documento de identidad se protege por acceso y auditoría. Se reconsidera con la
segunda institución.

## Criterio de salida (por fase)

- F1: CSP sin `unsafe-inline` en staging; CSRF probado; test de aislamiento; gitleaks en CI.
- F3: subida con magic bytes probada con un SVG renombrado a `.png` (rechazado).
- F5: webhook con firma inválida → 401; evento duplicado → un solo `Payment`.
- F6: restauración ensayada; runbook de incidente escrito.
