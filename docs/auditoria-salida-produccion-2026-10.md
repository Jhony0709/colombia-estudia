# Auditoría de salida a producción — 31/10/2026

Alcance: seguridad (middleware, autenticación, API), base de datos y Supabase, privacidad y
cumplimiento legal en Colombia, SEO y alta en buscadores, infraestructura, despliegue y operación.
Cuatro revisiones independientes de solo lectura sobre el código y el sitio en vivo
(`https://albafuturoeducativo.com`), y verificación propia de los bloqueantes. No se pudieron leer
cabeceras HTTP en vivo (el proxy bloquea `curl`), ni los paneles de Vercel, Supabase, GitHub,
Wompi o Resend: lo que depende de ellos va marcado **[comprobar]**.

Gravedad: **BLOQUEA** (no abrir así) · **ANTES DE REGISTRAR** (antes de dar de alta en Google
Search Console / Bing o de abrir el registro al público) · **DESPUÉS** (mejora sin prisa).
Archivo protegido: 🔒.

## 0. Estado (01/11): aplicado en código, sin commit

- **B1:** `lib/authz/routes.ts` rechaza caracteres de control y exige mismo origen; caso nuevo en
  `__tests__/unit/authz/routes.test.ts`.
- **B2:** migración `20261101000000_rls_missing_tables` (RLS en `Counter`, `ProgramPrice`,
  `EnrollmentModule`; `next_code` y `_prisma_migrations` fuera de `anon`/`authenticated`). Probada
  sobre Postgres 16 limpio con las 25 migraciones. Llega a staging y producción solo por el CI.
- **B3:** `next` y `eslint-config-next` a `15.5.28` exacto. Falta `pnpm install`, build y e2e.
- **B4:** sin `dataPolicyUrl`, los cuatro enlaces (registro, invitación, pie, `AuthShell`) van a
  `/politica-de-datos`. El dato en `/admin/institucion` sigue pendiente.
- **B5:** `crons` en `apps/web/vercel.json` y `maxDuration = 300` en la ruta. Falta `CRON_SECRET` en
  Vercel Production.
- **B6:** sin `WOMPI_API_URL`, la URL sale de la llave (`prv_prod_` → producción);
  `isWompiConfigured` exige también `WOMPI_PRIVATE_KEY`; `import 'server-only'`; variables en
  `reference/08-env-vars.md`.
- **B8:** `@default("")` en los cuatro `code`. Falta el paso 3 (`migrate diff` contra cada base).
- **B9:** cinco modelos más en `tenant-isolation.test.ts` y `RUN_DB_TESTS` en `turbo.json`.
- **A2, A3:** cookies `HttpOnly` y `Secure` en los dos `createServerClient`; el middleware reenvía la
  cookie refrescada. `lib/auth/supabase-browser.ts` movido a `_to_delete/val-0111/`.
- **A19:** la expresión del canonical en `seo.spec.ts`.
- **A1 (01/11, en Vercel):** el apex es Production y `www` redirige 308 al apex.
- **Siguen abiertos:** B7 (paneles), A4-A18 y todo lo de las secciones 4-6.

## 1. Veredicto

El sitio público ya sirve lo esencial (robots, sitemap, canonical, JSON-LD, política de datos,
contenido cargado). **No conviene abrir el registro ni dar de alta en buscadores todavía.** Hay
nueve bloqueantes; seis son cambios pequeños de código y tres son configuración de paneles.

| #   | Bloqueante                                                                           | Tipo                  | Esfuerzo |
| --- | ------------------------------------------------------------------------------------ | --------------------- | -------- |
| B1  | Open redirect en `next` con tabulador o salto de línea                               | Código                | Bajo     |
| B2  | Tres tablas sin RLS (`Counter`, `ProgramPrice`, `EnrollmentModule`) y Data API       | Código + Supabase     | Bajo     |
| B3  | `next@15.5.25`, por debajo de la versión de seguridad 15.5.28 (14/10/2026)           | Código                | Bajo     |
| B4  | El registro pide aceptar la política sin enlazarla                                   | Dato + código         | Bajo     |
| B5  | El job diario no está programado (`vercel.json` sin `crons`)                         | Código                | Bajo     |
| B6  | Wompi cae a sandbox si falta `WOMPI_API_URL`: los pagos de producción se pierden     | Vercel + código       | Bajo     |
| B7  | Orden migración → despliegue no garantizado (auto-deploy de Vercel)                  | GitHub + Vercel       | Medio    |
| B8  | Historial de migraciones con tres migraciones vacías y `migrate dev` contra remotos  | 🔒 schema + operación | Bajo     |
| B9  | El test de aislamiento por tenant no cubre 5 modelos y rompe la suite de integración | Código                | Bajo     |

## 2. Bloqueantes

### B1 · Open redirect en el parámetro `next` — BLOQUEA

- **Dónde:** `apps/web/lib/authz/routes.ts:85-111` (`isValidNextUrl`). Lo usan el login
  (`app/(public)/auth/login/login-content.tsx:70`, `window.location.assign`), `api/auth/login`,
  el callback, el magic link y el MFA.
- **Evidencia (comprobado):** la validación rechaza `//`, `://` y `\`, pero acepta `"/\t/evil.com"`
  y `"/\n/evil.com"`. `new URL("/\t/evil.com", "https://albafuturoeducativo.com").href` da
  `https://evil.com/`. `?next=/%09/evil.com` llega decodificado como tabulador.
- **Escenario:** el atacante pide un magic link para el correo de la víctima con ese `next`; la
  víctima recibe un correo legítimo de ALBA, entra y termina en el sitio del atacante.
- **Arreglo:** rechazar caracteres de control (`/[\u0000-\u001F\u007F]/`) o, mejor, resolver con
  `new URL(next, 'https://x.invalid')` y exigir el mismo origen. Añadir `%09`, `%0A`, `%0D` a
  `__tests__/unit/authz/routes.test.ts`.

### B2 · Tablas sin RLS con la llave publicable en el navegador — BLOQUEA

- **Dónde:** `prisma/migrations/20260925000000_entity_codes` (`Counter` y la función `next_code`),
  `20260925100000_program_prices` (`ProgramPrice`), `20261003000200_enrollment_module_unlock`
  (`EnrollmentModule`). Ninguna activa RLS ni la activa una migración posterior (comprobado). Las
  otras 38 tablas sí lo tienen. `_prisma_migrations` tampoco.
- **Escenario [comprobar permisos]:** con la llave publicable del bundle, `POST /rest/v1/EnrollmentModule`
  se habilita componentes de pago o `PATCH /rest/v1/ProgramPrice` cambia precios, si el rol `anon`
  tiene permisos sobre esas tablas (por defecto en Supabase los tiene sobre `public`).
- **Arreglo:**
  1. Migración nueva: `ENABLE ROW LEVEL SECURITY` + `deny_anon`/`deny_authenticated` en las tres
     tablas y en `_prisma_migrations`; `REVOKE EXECUTE ON FUNCTION public.next_code(text,text,text)
FROM PUBLIC, anon, authenticated;`.
  2. Supabase (staging y producción) → Integrations → Data API: apagarla (la app no usa PostgREST,
     todo va por Prisma) o al menos «Automatically expose new tables» en off.
  3. Test de integración que falle si alguna tabla de `public` tiene `relrowsecurity = false`.
  4. Comprobación de solo lectura: `select relname, relrowsecurity from pg_class where
relnamespace='public'::regnamespace and relkind='r';`.

### B3 · Next.js con vulnerabilidades críticas publicadas — BLOQUEA

- **Dónde:** `apps/web/package.json:58` (`"next": "^15.0.0"`), `pnpm-lock.yaml:9683` (`next@15.5.25`).
- **Evidencia:** el 14/10/2026 salió 15.5.28 como versión de seguridad: RCE en el procesado de SVG
  de Image Optimization (CVE-2026-96889, crítica) y DoS en Server Actions (GHSA-p3m5-59mp-jv5r).
  Atenuantes en este repo: `sharp` forzado a `^0.35.5`, sin `remotePatterns`, sin `'use server'`.
  Aun así, se sube.
- **Arreglo:** `next` y `eslint-config-next` a `15.5.28` exacto en `apps/web/package.json`,
  `pnpm install`, build y e2e. **DESPUÉS:** la línea 15 llega a fin de soporte en octubre de 2026;
  planear la migración a Next 16.

### B4 · El registro pide aceptar la política de datos sin enlazarla — BLOQUEA

- **Dónde:** `app/(public)/registro/registration-content.tsx:331-340`,
  `features/marketing/sections/site-footer.tsx:59-65`, `components/templates/auth-shell/AuthShell.tsx:144`.
  El enlace solo aparece si `Institution.dataPolicyUrl` existe.
- **Evidencia en vivo:** el pie no tiene la columna «Legal» y `/registro` no enlaza la política: el
  dato está vacío en producción. La única referencia interna a `/politica-de-datos` es el sitemap.
- **Escenario:** una persona acepta un tratamiento que no puede leer; la autorización no es
  informada (Ley 1581, arts. 9 y 12). Además la página queda huérfana para Google.
- **Arreglo:** en `/admin/institucion`, `dataPolicyUrl = https://albafuturoeducativo.com/politica-de-datos`.
  En código, usar `dataPolicyUrl ?? '/politica-de-datos'` en los tres sitios para no depender del dato.

### B5 · El job diario no corre — BLOQUEA

- **Dónde:** `apps/web/vercel.json` (solo `framework`), `app/api/jobs/daily/route.ts`,
  `features/jobs/server/daily.service.ts:9-16`.
- **Qué no ocurre:** cierre de intentos vencidos, emisión de constancias (el onboarding promete que
  «se emiten solas»), avisos de mora y acuerdos, recordatorios de sesiones en vivo, conciliación de
  pagos y barrido de medios.
- **Arreglo:** en `apps/web/vercel.json`, `"crons": [{ "path": "/api/jobs/daily", "schedule": "0 10 * * *" }]`
  (05:00 Bogotá), `export const maxDuration = 300` en la ruta y `CRON_SECRET` en Vercel Production.
  Los pasos 3-6 de `daily.service.ts` no tienen `try/catch`: una excepción corta el job y no deja su
  `AuditLog` (**DESPUÉS**).

### B6 · Wompi apunta a sandbox por defecto — BLOQUEA (si se abre el pago en línea)

- **Dónde:** `apps/web/lib/billing/wompi.ts:17` (`WOMPI_API_URL || 'https://sandbox.wompi.co/v1'`),
  `:20-26`, `features/billing/server/account.service.ts:166-168`, `app/api/webhooks/wompi/route.ts:32`.
- **Escenario:** sin `WOMPI_API_URL` en Production, el webhook consulta la transacción en sandbox con
  la llave de producción, recibe `null`, la marca `pending` y responde 200: Wompi no reintenta y la
  conciliación del job tampoco la recupera. El estudiante pagó y su cuota sigue vencida.
- **Arreglo:** en Vercel Production, `WOMPI_API_URL=https://production.wompi.co/v1` y las llaves de
  producción (`WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`).
  En código, derivar la URL del prefijo de la llave (`prv_prod_`) o fallar en producción si falta;
  incluir `WOMPI_PRIVATE_KEY` en `isWompiConfigured` e `import 'server-only'`. Documentar las cuatro
  variables en `reference/08-env-vars.md`.

### B7 · El código puede llegar a producción antes que su migración — BLOQUEA

- **Dónde:** 🔒 `.github/workflows/deploy.yml:35-55`; `docs/estado.md:1359-1362`.
- **Qué pasa:** `migrate-prod` solo corre con `vars.HAS_PROD == 'true'` y `deploy-vercel` con
  `vars.DEPLOY_FROM_ACTIONS == 'true'`. Si no, Vercel despliega por Git al recibir el push y la
  migración llega tarde o nunca (es lo que pasó con `isPreview`: 500 en todas las páginas).
- **Arreglo:** GitHub → Variables `HAS_PROD=true`, `DEPLOY_FROM_ACTIONS=true`; environment
  `production` con `DIRECT_URL_PROD` (5432) y revisores obligatorios. Vercel → Settings → Git:
  desactivar el auto-deploy de `main` y `develop` (o `"git": { "deploymentEnabled": { "main": false,
"develop": false } }` en `apps/web/vercel.json`). Documentar `prisma migrate resolve` en
  `docs/runbooks/rollback.md` para una migración fallida.

### B8 · Historial de migraciones — BLOQUEA (hasta dejarlo consistente)

- **Dónde:** `prisma/migrations/20261031113347_`, `20261031145229_students_view`,
  `20261031151044_students_view` (mismo SQL: `ALTER COLUMN "code" SET DEFAULT ''::text` en cuatro
  tablas). Causa: 🔒 `prisma/schema.prisma:132,333,601,701` (`@default(dbgenerated("''::text"))`
  frente a `DEFAULT ''` en la base): cada `prisma migrate dev` genera otra igual.
- **Estado:** el 31/10 se corrió `migrate dev` a mano contra staging y contra producción, fuera del CI.
  Producción tiene 22 de 24 aplicadas; las dos pendientes son las vacías.
- **Arreglo:**
  1. No borrar, renombrar ni editar ninguna migración del 31/10; commitearlas tal cual.
  2. 🔒 Cambiar los cuatro `dbgenerated("''::text")` por `@default("")`.
  3. Comprobar con `prisma migrate diff --from-schema-datasource prisma/schema.prisma
--to-schema-datamodel prisma/schema.prisma --exit-code` contra cada base que el diff es vacío.
  4. No volver a usar `migrate dev` contra bases remotas; para el cliente basta `pnpm db:generate`.
  5. Que `.env` y `.env.local` apunten a staging. Hoy `.env.local` apunta a producción, así que
     `localhost` lee y escribe en producción.

### B9 · El test de aislamiento por tenant no corre — BLOQUEA (no se puede confiar en el CI)

- **Dónde:** `apps/web/__tests__/integration/db/tenant-isolation.test.ts:36-71` (`PARENTS` sin
  `ProgramPrice`, `Counter`, `EnrollmentModule`, `AccessRequest`, `ModuleFeedback`), `:403`
  (`Unknown model`), `:467` (recorre todo `TENANT_SCOPED_MODELS`).
- **Qué pasa [comprobar en Actions]:** con `RUN_DB_TESTS=1` el `beforeAll` lanza y cae toda la
  suite; si además `turbo.json` no deja pasar `RUN_DB_TESTS` (modo estricto de Turborepo), queda en
  `describe.skip` y sale verde sin probar nada.
- **Arreglo:** añadir los cinco modelos a `PARENTS` y `createEntity`; añadir `RUN_DB_TESTS` a
  `globalEnv` (o `passThroughEnv` de `test:integration`) en `turbo.json`; mirar el log del job.

## 3. Antes de registrar en buscadores o abrir el registro

### Dominio y host canónico

- **A1 · `www` y apex sin una redirección 308 clara.** Las revisiones vieron enlaces resueltos
  contra `www` mientras el canonical, el sitemap y el robots usan el apex. Además, recuperación,
  magic link, invitaciones y checkout construyen URL con `req.nextUrl.origin`
  (`app/api/auth/recover/route.ts:25`, `magic-link/route.ts:24`, `app/api/people/invitations/route.ts:26`,
  `learn/account/pay/route.ts:28`): quien pide un enlace desde `www` recibe un callback en `www`, con
  la cookie PKCE de otro host.
  **Arreglo:** Vercel → Domains: apex como dominio de producción sin redirección; `www` → «Redirect to
  albafuturoeducativo.com» con **308**. Comprobar desde una red sin proxy con `curl -sI`. En código,
  usar `siteUrl()` (`lib/seo/site-url.ts`) en lugar del origen de la petición.

### Seguridad

- **A2 · Cookies de sesión sin `HttpOnly` ni `Secure`.** `@supabase/ssr` 0.8 usa `httpOnly: false` por
  defecto y no se pasa `cookieOptions` (`lib/auth/supabase-server.ts:33-46`, 🔒 `middleware.ts:98-117`).
  Un XSS que pase la CSP roba una sesión de 400 días. `lib/auth/supabase-browser.ts` no se usa.
  **Arreglo:** `cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production' }` en
  los dos `createServerClient` y borrar el cliente de navegador.
- **A3 · El middleware reenvía las cookies viejas tras refrescar la sesión.** 🔒 `middleware.ts:85,106-110`:
  `requestHeaders` se copia antes del refresco. Resultado: un segundo refresco por petición y riesgo de
  cierres de sesión intermitentes por la detección de reutilización. **Arreglo:** dentro de `setAll`,
  `requestHeaders.set('cookie', request.headers.get('cookie') ?? '')`.
- **A4 · Sin límite real de intentos.** `lib/http/rate-limit.ts` es un `Map` en memoria por instancia;
  `api/auth/login` no tiene límite; recover, magic link y request-new delegan en un WAF no configurado.
  Además, los límites de Supabase Auth son por IP y todas las llamadas salen de las IP de Vercel: un
  pico de clase puede dar 429 a todos. **Arreglo:** Vercel Firewall con reglas por IP para
  `/api/auth/*`, `/auth/*`, `/api/invitations/*`, `/api/certificates/*`, `/api/media/upload`;
  Supabase → Auth → Rate Limits: subirlos y activar el reenvío de IP (`Sb-Forwarded-For`).
- **A5 · El registro permite enumerar cuentas y ocupar correos ajenos.**
  `features/auth/server/registration.service.ts:79-105` distingue los casos en el mensaje y confirma
  el correo sin verificarlo (`email_confirm: true`). **Arreglo:** verificar el correo antes de crear
  la sesión y la matrícula, y responder siempre con un mensaje genérico.
- **A6 · El tamaño real de lo subido no se comprueba.** `features/content/server/media.service.ts:69,204-213`
  confía en `sizeBytes` del cliente. **Arreglo:** en `confirmUpload`, borrar y responder 400 si
  `head.sizeBytes > MAX_BYTES[kind]`; en Supabase, `file_size_limit` y `allowed_mime_types` en el
  bucket `media` (privado).
- **A7 · `requireStaffMfa`** lo puede apagar un ADMIN (default `true`). Comprobar el valor en producción.

### Datos personales y cumplimiento

- **A8 · La política no identifica al responsable.** En vivo faltan razón social, NIT y domicilio
  (`app/politica-de-datos/page.tsx:50-71`; `dataPolicy.controller.addressValue` no existe en
  `messages/es-CO.json`). Lo exige el Decreto 1074 de 2015, art. 2.2.2.25.3.1. **Arreglo:** `legalName`
  y `taxId` en `/admin/institucion`, `addressValue` en los mensajes, y `legalName`/`taxID`/`address`
  en `features/marketing/structured-data.tsx`.
- **A9 · Menores de edad.** Un menor se registra y se le tratan datos sin autorización del
  representante (`registration.service.ts:65-68,135-145,167`), contra la Ley 1581, art. 7. **Decisión
  con asesoría jurídica:** rechazar el registro de menores de 18 hasta tener el flujo del acudiente, o
  pedir sus datos y una autorización verificable.
- **A10 · Ajustes razonables (dato sensible).** `features/inclusion/server/accommodations.service.ts:113-175`
  no registra la autorización explícita y copia `notes` al `AuditLog` (inmutable). **Arreglo:** registrar
  la autorización antes del primer ajuste (🔒 schema si se modela) y auditar solo `notesChanged`.
- **A11 · Términos y condiciones y Estatuto del Consumidor (antes de activar el pago en línea).** No hay
  `/terminos`, PQR ni información de retracto. Vender cursos en línea es comercio electrónico (Ley 1480,
  arts. 47, 50 y 51; Ley 2439 de 2024). **Arreglo:** página de términos revisada por un abogado,
  enlazada en el pie y en el checkout.
- **A12 · Anonimización incompleta.** `features/people/server/anonymize.service.ts:86-96`: el borrado en
  Auth puede fallar en silencio (`deleteUser` devuelve `{ error }`, no lanza); los `Notification.body`
  siguen nombrando a la persona; el texto libre (`notes`, `comment`) no se toca.
- **A13 · Datos de demo y de prueba.** `institution:create` deja «Colombia Estudia (demo)» como remitente
  y el programa `DEMO` (`packages/scripts/institution/build.ts:92-105`). Revisar en producción con
  consultas de solo lectura: `Institution.emailFromName`, programas `DEMO` o `sourceRef like 'prueba:%'`,
  personas `@yopmail.com`. Archivar o anonimizar desde la app. Los seeds de prueba
  (`seed/cursos-prueba.ts`) no tienen `--ref`: añadirlo y rechazar el ref de producción.

### Operación

- **A14 · Sentry no recibe los errores de páginas, del webhook ni del cron.** `apps/web/instrumentation.ts`
  no exporta `onRequestError`; solo `api-handler.ts:212` captura. **Arreglo:**
  `export const onRequestError = Sentry.captureRequestError;`, `environment`/`release` de Vercel en
  `lib/observability/sentry.ts`, y alertas.
- **A15 · Resend Free: 100 correos al día** compartidos entre la app y el SMTP de Supabase. Pasar a Pro
  antes de invitar una cohorte o abrir el registro.
- **A16 · Health no detecta un despliegue roto.** `app/api/health/route.ts` solo hace `SELECT 1`. Que
  resuelva la institución y reporte si correo y Wompi están configurados (sin valores).
- **A17 · Supabase de producción: plan y backups [comprobar].** Producción es un proyecto propio
  (`cimftmqxevucicokmmpy`, distinto de staging). Si es Free, no hay backups diarios, ni protección contra
  contraseñas filtradas, ni límite de sesión. El runbook de restauración (`docs/runbooks/restore.md`)
  tiene errores: los backups no incluyen Storage ni las contraseñas de roles propios. **Arreglo:** plan
  Pro, copia externa de Storage, reescribir y ensayar el runbook.
- **A18 · Vimeo:** los videos «no listados» no cargan sin el hash `h=` (`lib/media/vimeo.ts:35-39`).
  Usar privacidad «Ocultar de Vimeo» con embed solo en el dominio.
- **A19 · CI de SEO:** `apps/web/__tests__/e2e/seo.spec.ts:39` espera un canonical acabado en `/`, pero
  Next escribe el de la raíz sin barra. Cambiar la expresión a `/^https?:\/\/[^/]+\/?$/`.

## 4. Después

- `next.config.ts`: `poweredByHeader: false`. 🔒 `middleware.ts`: quitar `x-nonce` de la respuesta,
  añadir `report-to` a la CSP, `Cross-Origin-Opener-Policy: same-origin`. HSTS `preload` solo si se
  decide para todos los subdominios.
- Tokens de invitación en logs y en Sentry (`lib/http/api-handler.ts:90`, `lib/observability/sentry.ts:46-50`):
  registrar el patrón de ruta y limpiar `request.url`. `errorFormat: 'minimal'` en Prisma.
- `route-guard.test.ts:97` se satisface con un texto: endurecerlo.
- Enlace mágico y recuperación con PKCE fallan si se abren en otro navegador: pasar a `token_hash` +
  `verifyOtp`.
- `connection_limit=1` con Fluid compute de Vercel: subirlo a 3-5 y vigilar P2024.
- `app_writer` no se usa; el trigger append-only no cubre `TRUNCATE`.
- `supabase/config.toml` contradice la configuración real (registro abierto, contraseña de 6, TOTP off).
- Consentimiento comercial en una casilla aparte y opcional (Ley 2300 de 2023).
- Analítica sin cookies (Vercel Web Analytics y Speed Insights) y mención en la sección 12 de la política.
- Pequeños de SEO: `og:image:alt`, `favicon.ico`, títulos de `/auth/recuperar`, `/auth/restablecer`,
  `/auth/mfa`; axe en `/registro`; test de `robots()` con `VERCEL_ENV=production`.
- Documentación: `docs/estado.md` (sin entradas desde el 8/10), `docs/handoff.md` (habla de Valida YA),
  `docs/runbooks/rollback.md` (es la vuelta a LearnDash), `reference/08-env-vars.md` (faltan las
  variables de Wompi y `LOG_LEVEL`).

## 5. Alta en Google Search Console y Bing

Hacerlo **después** de B4, A1 y A8.

1. **Comprobaciones previas** (desde una red sin proxy):
   - `curl -sI https://albafuturoeducativo.com/` → 200 y `strict-transport-security`.
   - `curl -sI https://www.albafuturoeducativo.com/` → 308 a `https://albafuturoeducativo.com/`.
   - `curl -s https://albafuturoeducativo.com/robots.txt` → `Allow: /`, `Disallow: /api/`,
     `Sitemap: https://albafuturoeducativo.com/sitemap.xml`.
   - `curl -s https://albafuturoeducativo.com/sitemap.xml` → `/`, `/registro`, `/auth/login`,
     `/politica-de-datos`, todas en el apex.
   - Vercel Production: `NEXT_PUBLIC_APP_URL=https://albafuturoeducativo.com`.
2. **Google Search Console:** Añadir propiedad → **Dominio** → `albafuturoeducativo.com` → copiar el
   registro `google-site-verification=…` → crear un TXT `@` en el DNS → Verificar. No usar la
   verificación por archivo: el middleware protege `googleXXXX.html` y redirige al login
   (`lib/authz/routes.ts`, denegación por defecto).
3. **Sitemaps** → `https://albafuturoeducativo.com/sitemap.xml`. **Inspección de URLs** →
   `https://albafuturoeducativo.com/` → Solicitar indexación. Revisar el informe de robots.txt.
4. **Bing Webmaster Tools:** «Importar desde Google Search Console» con la misma cuenta. IndexNow no
   hace falta con cuatro URL.
5. **Validar datos estructurados:** Prueba de resultados enriquecidos y validator.schema.org sobre `/`.
   No añadir `FAQPage` ni `Course`: Google ya no los muestra para este caso.
6. **Google Business Profile:** no aplica a un servicio 100 % en línea sin sede que atienda al público.

## 6. Tareas en paneles

- **Vercel:** Domains (A1); Environment Variables de Production: Wompi de producción (B6), `CRON_SECRET`,
  `RESEND_API_KEY`, `EMAIL_DOMAIN`, `SENTRY_DSN`, `VIMEO_ACCESS_TOKEN`, `NEXT_PUBLIC_APP_URL`, las cinco
  de Supabase de producción; Preview con staging y Wompi sandbox; Git sin auto-deploy (B7); Firewall
  (A4); Deployment Protection en Preview; plan Pro (uso comercial con pagos).
- **Supabase producción:** Data API apagada (B2); Auth → «Allow new users to sign up» se queda encendido (decisión de Jhonny, 01/11: el
  registro es abierto), TOTP on,
  contraseña mínima 12, contraseñas filtradas (Pro), sesiones (Pro), rate limits y reenvío de IP (A4),
  Site URL y Redirect URLs del apex (y `www` mientras no redirija), SMTP de Resend, plantillas de
  `supabase/templates/`; Storage: bucket `media` privado con límites (A6); backups (A17); Advisors →
  Security sin avisos.
- **GitHub:** variables `HAS_PROD` y `DEPLOY_FROM_ACTIONS`, environment `production` con revisores,
  protección de `main` con CI verde (B7, B9).
- **Wompi producción:** URL de eventos `https://albafuturoeducativo.com/api/webhooks/wompi`, secreto
  igual a `WOMPI_EVENTS_SECRET`, un pago real de bajo monto.
- **Resend:** plan Pro; SPF, DKIM y DMARC en PASS.
- **Vimeo:** privacidad y dominios permitidos (A18).
- **Sentry:** alertas por issue nuevo y por `job-*`; monitor externo sobre `/api/health`.
- **`/admin/institucion`:** razón social, NIT, remitente «ALBA Futuro Educativo», `dataPolicyUrl`,
  cohorte de introducción; archivar «Programa demo».
- **Local:** `.env` y `.env.local` de vuelta a staging.

## 7. Lo que está bien

- Denegación por defecto de rutas y guardias por área (`lib/authz/routes.ts:53-69`, `lib/authz/staff.ts`).
- CSRF por `Sec-Fetch-Site` y `Origin` en todo método no seguro (`lib/http/api-handler.ts:48-76`);
  errores genéricos; login, recover y magic link no revelan si la cuenta existe.
- MFA del personal con `aal2` (`lib/authz/request-context.ts:302-314`); sesión validada con `getUser()`.
- Invitaciones con token de 256 bits guardado como hash.
- Secretos detrás de `server-only`; `answerKey` omitida globalmente y leída solo al calificar y en el editor.
- HTML de contenido saneado con esquema cerrado; JSON-LD escapado con nonce; CSV sin fórmulas.
- Subidas con lista blanca sin SVG, magic bytes, bucket privado y URLs firmadas de 10 minutos.
- CSP con nonce y `strict-dynamic`, nosniff, Referrer-Policy, Permissions-Policy, HSTS.
- Webhook de Wompi con checksum en tiempo constante, reconsulta a la API e idempotencia por `gatewayRef`.
- RLS en 38 tablas, aislamiento por tenant con tests unitarios, append-only de `AuditLog` y `LearningEvent`.
- Sentry y pino sin PII; política de datos completa en finalidades, derechos, plazos, encargados y
  transferencia internacional (Circular SIC 005 de 2017).
- SEO: `metadataBase`, plantilla de título, canonical, `lang="es-CO"`, robots y sitemap correctos en
  vivo, `noindex` donde toca, imagen OG de 1200×630, `next/image` con `priority`, fuentes autoalojadas,
  axe WCAG 2.2 AA en las páginas públicas.

## Fuentes externas

- Next.js 15.5.28: [CSA Singapur AL-2026-148](https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2026-148/),
  [Netlify, 14/10/2026](https://www.netlify.com/changelog/2026-10-14-nextjs-react-security-vulnerabilities.md).
- Supabase: [rate limits](https://supabase.com/docs/guides/auth/rate-limits),
  [backups](https://supabase.com/docs/guides/platform/backups),
  [securing your API](https://supabase.com/docs/guides/api/securing-your-api),
  [password security](https://supabase.com/docs/guides/auth/password-security).
- Google: [FAQPage](https://developers.google.com/search/docs/appearance/structured-data/faqpage),
  [Course info](https://developers.google.com/search/docs/appearance/structured-data/course-info).
- Colombia: [Decreto 1074 de 2015, art. 2.2.2.25.3.1](https://encolombia.com/derecho/decretos/decreto-mincit/politicas-tratamiento-informacion/),
  [Ley 2439 de 2024](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=257116).
