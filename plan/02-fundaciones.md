# 02 — Fundaciones (fase 1, semanas 1-3)

## Objetivo

Que en la semana 3 exista una plataforma desplegada en staging, sin pantallas, con todo lo
que después nadie quiere hacer: entornos separados, migraciones por CI, aislamiento por
tenant probado, reglas del dominio probadas, observabilidad, tokens y módulo de a11y.

## Pasos

### 1. Repositorio y monorepo

- Copiar la plantilla de don-pepo (`~/development/food-save`) sin `apps/mobile`, `android/`,
  `ios/`, `app.json`, `.easignore`, `.expo/`. Conservar `turbo.json`, `pnpm-workspace.yaml`,
  `.husky/`, `knip.json`, `prettier.config.mjs`, `tsconfig.base.json`, lint-staged.
- `packages/config` con eslint (incluye `eslint-plugin-jsx-a11y` en `strict`), tsconfig
  strict, depcruise con las reglas de `01-arquitectura-y-estructura.md`.
- Primer commit de Jhonny: estructura vacía + `reference/` + `plan/`. `.gitignore` con
  `.env*` salvo `.env.example`.

### 2. Entornos (ADR-0001, 15/9: sin Supabase CLI; un solo proyecto hasta producción)

| Entorno   | Base de datos                                                                                                                                                  | Auth                                    | Storage        | Para qué                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `local`   | **El proyecto de staging** (sin Supabase CLI). Tests de integración: Postgres plano local (`docker run postgres:16`), con las variables en la línea de comando | staging                                 | staging        | desarrollo; **nunca datos reales**                                                 |
| `staging` | Proyecto Supabase "colombia-estudia-staging" (Free)                                                                                                            | invitaciones reales a cuentas de prueba | bucket privado | Vercel Production **y** Preview mientras no exista prod; importación de prueba, QA |
| `prod`    | Proyecto Supabase "colombia-estudia" (Pro) — **se crea cuando el producto esté listo**                                                                         | real                                    | bucket privado | producción                                                                         |

Vercel: un proyecto; hasta que exista prod, `main` y las previews apuntan a staging. Variables
por entorno según `reference/08-env-vars.md`, cargadas en Vercel, nunca en el repo. El `.env`
local se rellena a mano con los valores de staging (`.env.example`).

### 3. Prisma y base de datos

- `prisma/schema.prisma` tal cual está. `prisma migrate dev --name init` en local genera la
  migración; **se edita a mano** para añadir el SQL que Prisma no expresa
  (`prisma/sql/001-partial-indexes.sql`, ver `05-datos-y-migraciones.md`).
- `prisma migrate deploy` corre en GitHub Actions al mergear a `main`, antes del deploy,
  con `DIRECT_URL` de prod como secreto de Actions. A mano, jamás.
- RLS: migración `002-rls.sql` que habilita RLS en todas las tablas y crea políticas que
  deniegan todo a `anon` y `authenticated`. El servidor usa `service_role`.
- `lib/db/prisma.ts`: singleton con `omit: { assessmentVersion: { answerKey: true } }`
  global (Prisma ≥ 6.2; con 5.x el preview `omitApi`).
- `lib/db/tenant.ts`: cliente extendido que inyecta `institutionId` en `findMany`,
  `findFirst`, `count`, `update*`, `delete*`, `create` (ver `05-datos-y-migraciones.md`).
  **Todo acceso a datos pasa por él**; el cliente base solo lo usan el importador de
  instituciones y el job.

### 4. Aislamiento por tenant, probado antes de cualquier feature

`__tests__/integration/tenant-isolation.test.ts`: crea dos instituciones con datos en cada
tabla (factory por modelo) y verifica, **para cada modelo del schema** (se recorre
`Prisma.dmmf.datamodel.models`), que el cliente de A no ve filas de B en `findMany`,
`count`, `findUnique` por id, ni puede actualizarlas. Un modelo nuevo sin factory rompe el
test: es la intención.

### 5. Dominio puro con tests

`packages/domain/src/` en este orden, cada uno con su `*.test.ts` al 90 %:

1. `capabilities.ts` — `resolveCapabilities(...)` → `Map<Capability, Scope[]>`; tabla de
   `acceso-y-cartera.md` §1 como casos; menor + cartera; acceso vencido conserva
   `score.read.own`.
2. `account-status.ts` — con `now`; `PARTNER_PAID`, acuerdo, cuota vencida, solo confirmados.
3. `attempt-policy.ts` — `getAttemptDeadline`, `getAttemptsAllowed`; `extraTimeFactor`,
   `exemptFromTimer`, `dueAt`, `accessUntil`.
4. `publish-validation.ts` — sobre el AST de `packages/types/content`.
5. `grading.ts` — `single_choice`, `multiple_choice`, `true_false`, `short_text` con
   normalización; `Score` derivado.
6. `lesson-completion.ts` y `enrollment-completion.ts` — evidencia por forma; secuencia lineal.
7. `metrics.ts` — fórmulas de `reportes.md`.

`packages/types/src/content.ts`: parser remark (CommonMark + GFM + `remark-math` +
`remark-directive` con `video`, `audio`, `pdf`, `lang`) que produce un AST tipado y una
lista de `asset:<id>`; rechaza HTML crudo; schema Zod de evaluación (`content` sin
respuestas, `answerKey` aparte). `catalogs.ts` con los literales de `schema.md`.

### 6. Tokens y accesibilidad antes del primer componente

- `packages/design-tokens`: contrato de `reference/03-ui/tokens.md` (nombres) + valores
  claro/oscuro + `focus.ring` + variables de preferencias de lectura; exporta un plugin de
  Tailwind que los expone como clases (`bg-surface-base`, `type-body`) y variables CSS.
  Test `contrast.test.ts` sobre cada par declarado.
- `apps/web/lib/a11y/`: `announce.ts` (dos regiones vivas globales), `focus-manager.ts`
  (foco al `h1` en cada navegación, retorno al disparador), `preferences-provider.tsx`
  (`readingPreferences` + media queries → variables CSS en `<html>`), `skip-link.tsx`,
  `visually-hidden.tsx`.
- Storybook con `addon-a11y`; `pa11y-ci` y `@axe-core/playwright` configurados aunque solo
  haya una página. El gate existe antes que el primer botón.

### 7. Observabilidad desde el primer handler

- `lib/observability/logger.ts`: pino, JSON, campos fijos `requestId`, `institutionId`,
  `personId` (hash), `route`, `durationMs`, `status`. Nunca PII en logs (email, documento,
  nombre) — el logger tiene un `redact` con esas rutas.
- `instrumentation.ts`: Sentry (`@sentry/nextjs`) con `beforeSend` que quita PII y
  `answerKey`; `tracesSampleRate` 0.1 en prod.
- `GET /api/health`: BD y Storage alcanzables; lo consulta Vercel/uptime.
- `lib/http/api-handler.ts`: todo route handler pasa por aquí (zod, capacidad, errores,
  log, `requestId`). Es el único lugar donde se construye una respuesta.

### 8. CI/CD

`.github/workflows/ci.yml` en cada PR: `pnpm install --frozen-lockfile` → `lint` (eslint +
depcruise + knip) → `type-check` → `test:unit` → `test:integration` (service container
`postgres:16` en el runner, ADR-0001; la migración crea los roles `anon`/`authenticated` si
faltan) → `build` → `pa11y-ci` sobre el build → `test:e2e` (Playwright con axe).
`deploy.yml` en `main`: `prisma migrate deploy` contra **staging** (`DIRECT_URL_STAGING`;
prod cuando exista, `HAS_PROD`) → Vercel deploy (opcional, `DEPLOY_FROM_ACTIONS`) → smoke
(`/api/health` = 200).
Ramas protegidas: `main` solo por PR con CI verde. Renovate para dependencias
(`12-calidad-y-proceso.md`).

### 9. Identidad y acceso

Ver `03-identidad-y-acceso.md`: middleware, sesión, login, invitación, recuperación,
`withCapability`, `GET /api/me`.

### 10. Institución de prueba y despliegue

`packages/scripts/institution/create.ts` crea "Institución Demo" con `primaryDomain` de
staging, un ADMIN y un programa vacío. Deploy en staging. Recorrido: login del admin,
`/api/me`, `/admin/institucion`. Con teclado y VoiceOver.

## Criterio de salida

- Test de aislamiento por tabla en verde para los 36 modelos.
- `packages/domain` y `packages/types` ≥ 90 % con los casos de `reference/`.
- `answerKey` no aparece en ninguna respuesta de un test de API.
- CI completa en verde en un PR de prueba; `migrate deploy` corrió por CI en staging.
- Staging responde en el dominio de prueba con login, `/api/me` y `/api/health`.
- Contraste de tokens en verde; Storybook con el primer átomo (`Button`) pasando addon-a11y.
