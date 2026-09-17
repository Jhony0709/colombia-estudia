# 01 — Arquitectura y estructura de carpetas

## Objetivo

Un monolito modular en Next.js 15 App Router, con el dominio en paquetes puros y una
estructura que un desarrollador nuevo entiende en diez minutos y que las herramientas
(depcruise, knip, eslint) pueden vigilar.

## Decisiones

- **Monorepo pnpm + turbo**, plantilla de don-pepo sin `apps/mobile`.
- **Feature-sliced dentro de `apps/web`**: cada dominio (`learn`, `cohorts`, `billing`…)
  tiene sus componentes, hooks, queries y código de servidor juntos. Las páginas en `app/`
  solo componen.
- **Reglas de dependencia como código** (depcruise): `app → features → lib → packages`;
  nunca al revés; `components/` no importa servicios; `packages/domain` no importa nada del
  runtime.
- **Route groups por área** para que cada área tenga layout, guard y navegación propios sin
  que aparezcan en la URL.

## Estructura

```
colombia-estudia/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/
│       │   │   ├── certificado/[code]/page.tsx
│       │   │   └── sin-acceso/page.tsx
│       │   ├── (auth)/
│       │   │   ├── auth/login/page.tsx
│       │   │   ├── auth/recuperar/page.tsx
│       │   │   ├── auth/restablecer/[token]/page.tsx
│       │   │   ├── auth/callback/route.ts
│       │   │   ├── auth/logout/route.ts
│       │   │   └── invitacion/[token]/page.tsx
│       │   ├── (student)/aprender/…          layout con guard lesson.read
│       │   ├── (partner)/aliado/…            layout con guard progress.read.cohort
│       │   ├── (staff)/                      layout con guard por capacidad de área
│       │   │   ├── contenido/…
│       │   │   ├── cohortes/…
│       │   │   ├── personas/…
│       │   │   ├── aliados/…
│       │   │   ├── cartera/…
│       │   │   └── inclusion/…
│       │   ├── (admin)/admin/…
│       │   ├── notificaciones/page.tsx
│       │   ├── api/                          route handlers en inglés (reference/02-api)
│       │   │   ├── me/route.ts
│       │   │   ├── learn/…
│       │   │   ├── cohorts/…
│       │   │   ├── billing/…
│       │   │   ├── webhooks/wompi/route.ts
│       │   │   └── jobs/daily/route.ts
│       │   ├── layout.tsx                    html lang, providers, skip link
│       │   ├── error.tsx · not-found.tsx · global-error.tsx
│       │   └── globals.css                   tokens como variables CSS
│       ├── features/
│       │   ├── auth/         { components, server, schemas }
│       │   ├── learn/        { components, hooks, queries, server }
│       │   ├── content/      { editor, publish, server }
│       │   ├── cohorts/      { components, queries, server, import }
│       │   ├── people/
│       │   ├── billing/      { components, queries, server, wompi }
│       │   ├── inclusion/
│       │   ├── partner/
│       │   ├── notifications/
│       │   └── admin/
│       ├── components/
│       │   ├── atoms/        Button, Input, StatusChip, VisuallyHidden…
│       │   ├── molecules/    FormField, Dialog, Sheet, Toast, Timer…
│       │   ├── organisms/    ProgramOutline, AttemptPlayer, VideoPlayer, DataTable…
│       │   └── templates/    AreaLayout, TwoPane, FocusedTask
│       ├── lib/
│       │   ├── db/           prisma.ts, tenant.ts (cliente extendido), transactions.ts
│       │   ├── auth/         supabase-server.ts, supabase-browser.ts, session.ts
│       │   ├── authz/        with-capability.ts, request-context.ts
│       │   ├── http/         api-handler.ts (envuelve: zod + errores + logging), responses.ts
│       │   ├── core/         errors.ts, result.ts, ids.ts, dates.ts (America/Bogota)
│       │   ├── a11y/         announce.ts, focus-manager.ts, preferences-provider.tsx, skip-link.tsx
│       │   ├── i18n/         next-intl config, formatters (COP, fechas)
│       │   ├── observability/ logger.ts (pino), sentry.ts, request-id.ts
│       │   ├── media/        storage.ts, vimeo.ts, mime.ts
│       │   ├── email/        resend.ts, templates/
│       │   └── query/        query-client.ts, keys.ts
│       ├── messages/es-CO.json
│       ├── middleware.ts
│       ├── instrumentation.ts               Sentry + pino init
│       ├── next.config.ts · tailwind.config.ts · tsconfig.json
│       └── __tests__/ { unit, integration, e2e }
├── packages/
│   ├── domain/           reglas puras (capabilities, account-status, attempt-policy,
│   │                     publish-validation, grading, lesson-completion,
│   │                     enrollment-completion, metrics) + tests
│   ├── types/            content.ts (parser Markdown + Zod evaluación), catalogs.ts, api.ts
│   ├── design-tokens/    contrato + valores + test de contraste
│   ├── config/           eslint, tsconfig, prettier, depcruise compartidos
│   └── scripts/          migrate/ (learndash, ocr), institution/create.ts, seed/
├── prisma/               schema.prisma, migrations/, sql/ (índices parciales, grants)
├── reference/            SSOT
├── plan/                 este plan
├── docs/                 análisis, auditorías, propuestas, adr/
├── .github/workflows/    ci.yml, deploy.yml
├── turbo.json · pnpm-workspace.yaml · package.json
└── CLAUDE.md · DESIGN.md · README.md · ROADMAP.md · PRODUCT_DECISIONS.md
```

## Límites entre capas (depcruise, en CI)

| Desde                   | Puede importar                                                            | Nunca                                                   |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `app/**`                | `features/**`, `components/**`, `lib/**`, `packages/*`                    | Prisma directo, `lib/db` (solo vía `features/*/server`) |
| `features/*/components` | `components/**`, `lib/a11y`, `lib/i18n`, `lib/query`, hooks de su feature | `lib/db`, `features/*/server` de **otra** feature       |
| `features/*/server`     | `lib/db`, `lib/authz`, `lib/http`, `packages/domain`, `packages/types`    | React, `components/**`                                  |
| `components/**`         | `lib/a11y`, `lib/i18n`, `packages/design-tokens`                          | `features/**`, `lib/db`, servicios                      |
| `packages/domain`       | `packages/types`                                                          | Prisma, Next, React, `apps/**`                          |
| `packages/types`        | zod, remark                                                               | Todo lo demás                                           |

La regla `components-no-servicios` de don-pepo se conserva; se añaden `domain-es-puro` y
`features-no-cruzan-server`.

## Convenciones de nombres

Las de `CLAUDE.md`: carpetas `kebab-case`; `.ts` en `kebab-case`; servicios `.service.ts`;
`.tsx` en `kebab-case` salvo default exports y el sistema de diseño; hooks `useX`. Route
handlers siempre `route.ts`; server actions en `actions.ts` dentro de la feature.

## Un request, de punta a punta

```
Browser ──▶ middleware.ts (sesión, request-id, cabeceras, host → x-tenant-host)
        ──▶ app/api/…/route.ts
              └─ apiHandler({ schema, capability, load, scopeOf })(fn)   lib/http + lib/authz
                    ├─ getRequestContext()   persona, institución, matrículas, capacidades (cache por request)
                    ├─ zod.parse(body)
                    ├─ fn(ctx, input) ──▶ features/*/server/*.service.ts
                    │                        ├─ packages/domain (decisión pura)
                    │                        └─ lib/db/tenant (Prisma con institutionId inyectado)
                    └─ { data } | APIError → { error }   + log estructurado + AuditLog si muta
```

## Criterio de salida

`pnpm lint:arch` (depcruise) y `pnpm knip` en verde con la estructura vacía; el diagrama
de arriba coincide con el código real en la fase 1.
