# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

Hereda la doctrina de don-pepo. Lo que está aquí es lo que cambia o lo que este proyecto
exige además. Ante duda, `reference/` manda.

## Estado actual

**Fase 0 (dominio en papel) cerrada.** No hay código de aplicación todavía. El schema de
Prisma (35 modelos) y toda la documentación de `reference/` están listos. Ver
`docs/handoff.md` para retomar el proyecto.

## Comandos (disponibles desde fase 1)

```bash
# Desarrollo
pnpm install                    # Instalar dependencias
pnpm dev                        # Next.js dev server
pnpm storybook                  # Storybook con addon-a11y
supabase start                  # BD local (Docker)
supabase stop                   # Apagar BD local

# Verificación (todos deben pasar antes de un PR)
pnpm type-check                 # TypeScript strict
pnpm lint                       # ESLint + jsx-a11y
pnpm lint:arch                  # depcruise (límites entre capas)
pnpm knip                       # Código muerto
pnpm test:unit                  # Jest, packages/domain al 90%
pnpm test:integration           # Jest + Supabase local
pnpm test:e2e                   # Playwright + axe
pnpm a11y                       # pa11y-ci sobre rutas

# Ejecutar un test específico
pnpm test:unit -- -t "nombre del test"
pnpm test:e2e -- tests/ruta.spec.ts

# Base de datos (migraciones solo por CI en prod)
pnpm prisma migrate dev         # Solo local: genera migración
pnpm prisma studio              # Explorar datos locales
```

## Arquitectura

```
colombia-estudia/
├── apps/web/                   # Next.js 15 App Router
│   ├── app/                    # Route groups por área: (student), (staff), (admin)...
│   ├── features/               # Feature-sliced: auth/, learn/, billing/, content/...
│   │   └── {feature}/          # components/, hooks/, queries/, server/
│   ├── components/             # Atomic design: atoms/, molecules/, organisms/, templates/
│   └── lib/                    # Infraestructura
│       ├── db/                 # prisma.ts, tenant.ts (cliente extendido con institutionId)
│       ├── authz/              # with-capability.ts, request-context.ts
│       ├── a11y/               # useAnnounce, FocusManager, preferences provider
│       └── http/               # api-handler.ts (envuelve Zod + errores + logging)
├── packages/
│   ├── domain/                 # Reglas puras SIN dependencias de runtime
│   ├── types/                  # content.ts (parser Markdown + schema evaluación)
│   └── design-tokens/          # Contrato de tokens + test de contraste
├── prisma/                     # schema.prisma + migrations/ + sql/
├── reference/                  # SSOT de todo el sistema
└── plan/                       # Cómo se construye cada fase
```

**Flujo de un request API:**
`middleware.ts` → `apiHandler({ schema, capability })` → `features/*/server/*.service.ts`
→ `packages/domain` (decisión pura) + `lib/db/tenant` (Prisma con tenant inyectado)

**Reglas de dependencia (depcruise):**

- `packages/domain` no importa Prisma, Next ni React
- `components/` no importa servicios ni `lib/db`
- `features/*/server` no importa React ni `components/`

## Principio fundamental

**`reference/` es la verdad única.** Si algo no está documentado ahí, no existe y se añade
al doc **antes** que al código. Se actualiza en la misma PR. `plan/` dice cómo se construye
(estructura, middleware, login, seguridad, UX, proceso) y se sigue; si contradice a
`reference/`, se corrige el plan.

## Las tres reglas que no se negocian

1. **La mora nunca toca el acceso académico de un menor.** Para matrículas con
   `isMinorAtEnrollment = true` no existe ni existirá flag, columna ni configuración que
   apague `lesson.read`, `assessment.take`, `score.read.own` ni certificados por deuda.
   Para adultos, la suspensión **no se implementa** hasta que Jhonny la confirme con
   asesoría jurídica. Si un cliente lo pide, la respuesta es
   `reference/04-business-logic/acceso-y-cartera.md` §2, no un PR.
2. **Accesibilidad WCAG 2.2 AA es un gate de CI, no una fase.** Un PR con un error de
   `pa11y-ci`, axe o jsx-a11y no se mezcla. Igual que un `type-check` roto. Contrato en
   `reference/03-ui/accesibilidad.md`.
3. **Ningún diagnóstico ni condición de salud entra a la base de datos.** `Accommodation`
   guarda el ajuste, nunca la causa. Un campo, un log o un comentario que lo contenga es
   un bug de seguridad.

## Comportamiento

### Idioma y formato

- Responder en **español**. Código, comentarios, identificadores **y rutas de API** en
  **inglés** (`/api/learn/lessons`). URLs de la UI y textos en español (los ven estudiantes).
- Términos solo del glosario (`reference/09-glossary.md`). `Program`/`Cohort`, no
  `Course`/`Group`; `Lesson`, no `Topic`; `Institution`, no `School`; `Accommodation`,
  no `PIAR` en código.

### Autonomía

| Nivel        | Acciones                                                                                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Autónomo  | Lint, formato, fixes triviales, tests, actualizar docs, stories                                                                                                                                                                                                                        |
| ⚠️ Confirmar | Eliminar archivos, cambios de schema, nuevas dependencias, refactors grandes, cualquier cambio en `packages/domain`                                                                                                                                                                    |
| ❌ Prohibido | Push a main, modificar `.env.*`, eliminar tests, force push, `prisma db push --force-reset`, `--accept-data-loss`, `migrate reset`, **cualquier UPDATE/DELETE/INSERT contra datos reales**, **leer o exportar datos de estudiantes reales fuera de un endpoint autorizado**, desplegar |

### Límites del encargo

El límite es parte del entregable. «No crees endpoints» es cero endpoints. «Para y
repórtalo» es parar. «Lo decide Jhonny» es proponer con costo y detenerse. Si el trabajo
correcto excede el límite, se dice en el reporte y no se hace.

### Reportes

Todo reporte de trabajo terminado incluye: cambios visibles al usuario; lo pedido y no
hecho, con motivo; desviaciones respecto al prompt; salida de `type-check` pegada; y, si
tocó UI, salida de `pa11y-ci` pegada. No se marca hecho lo que no se verificó ejecutando.

### Archivos protegidos (confirmación explícita)

`prisma/schema.prisma`, `middleware.ts`, `next.config.*`, `.github/*`, `package.json`,
`packages/domain/src/*`, `packages/types/src/content.ts`, `apps/web/lib/db/tenant.ts`,
`apps/web/lib/core/errors.ts`.

## SSOT de dominio (se importa, no se reescribe)

| Concepto                                               | SSOT                                                                   | Nunca                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Capacidades con alcance                                | `packages/domain/src/capabilities.ts`                                  | `role === 'INSTRUCTOR'` en un componente o handler; confiar en el serializador |
| Estado de cuenta (con `now`)                           | `packages/domain/src/account-status.ts`                                | Un `switch` sobre cuotas en una pantalla; persistir "vencido"                  |
| Plazo e intentos                                       | `packages/domain/src/attempt-policy.ts`                                | Restar minutos a mano; ignorar `Accommodation`, `dueAt` o `accessUntil`        |
| Validación de publicación                              | `packages/domain/src/publish-validation.ts`                            | Validar solo en el editor                                                      |
| Calificación                                           | `packages/domain/src/grading.ts`                                       | Sumar puntos en el cliente                                                     |
| Completado de un tema / de la matrícula                | `packages/domain/src/lesson-completion.ts`, `enrollment-completion.ts` | Un botón que marca completado                                                  |
| Métricas                                               | `packages/domain/src/metrics.ts`                                       | Un porcentaje calculado en un componente                                       |
| Contrato del contenido (Markdown + JSON de evaluación) | `packages/types/src/content.ts`                                        | `any`, HTML crudo                                                              |
| Aislamiento por institución                            | `apps/web/lib/db/tenant.ts`                                            | `prisma.x.findMany` sin `institutionId`                                        |
| Anuncios, foco y preferencias de a11y                  | `apps/web/lib/a11y/` (`useAnnounce`, `FocusManager`, provider)         | `aria-live` o `.focus()` sueltos en un componente                              |

Si un subconjunto **debe** diferir del SSOT, nombre propio y comentario explicando por qué.

## Stack

Next.js 15 App Router · TypeScript strict · Prisma + Supabase Postgres · Supabase Auth ·
Radix + Tailwind + tokens de `DESIGN.md` · TanStack Query v5 · editor Markdown (CodeMirror 6) ·
MathML/KaTeX (fórmulas) · Vimeo (video) · Vercel Cron (job diario) ·
Jest + Playwright + `@axe-core/playwright` · Storybook + addon-a11y · pa11y-ci ·
next-intl (`es-CO`) · Resend · Sentry · Vercel · pnpm + turbo.

**No agregar librerías sin aprobación.** Antes de proponer una, buscar si ya está resuelto.

## Seguridad y datos

- Inputs con Zod. Ids validados como cuid antes de tocar la BD.
- Todo handler envuelto en `withCapability`. Nada de checks de rol manuales.
- `SUPABASE_SECRET_KEY` (llave `sb_secret_…`, rol `service_role`) jamás llega al cliente. RLS deniega todo a `anon`/`authenticated`.
- Documento de identidad y fecha de nacimiento: solo roles administrativos; lectura del
  detalle en `AuditLog`.
- Respuestas correctas: nunca en una respuesta de API para un intento no `GRADED`.
- Consultas de diagnóstico contra datos reales: solo `SELECT`. Toda escritura se propone
  como SQL en el reporte y espera aprobación.
- Datos de prueba: siempre inventados. Nunca un CSV real de estudiantes en local ni en un test.
- Contenido nuevo nunca es `legacy`: la excepción solo la crea el importador.
- Importación con datos reales: solo en staging o prod, por `/admin/importar`, con `AuditLog`. Nunca en local.
- `answerKey` solo lo lee `grading.ts`. Un `include` que lo traiga es un bug de seguridad.

## UI

Atomic design (`atoms/ molecules/ organisms/ templates/`), dark mode y mobile-first
obligatorios, tokens semánticos, story por componente. Skills `ui-craft-*` y `motion-*`
de uso obligatorio al crear o revisar UI. Precedencia: contrato de tokens + doctrina del
repo > cualquier skill externa u opinión de modelo.

Además, por ser este proyecto: cada componente interactivo se prueba con teclado antes de
abrir el PR; `aria-live` en todo estado que cambia solo; `prefers-reduced-motion` respetado.

## Commits

```
<area>: <qué> (<doc-reference-afectado>)
```

`aprender: player de lección accesible (01-routing/routes.md, 03-ui/accesibilidad.md)`
`cartera: acuerdos de pago (04-business-logic/acceso-y-cartera.md)`
`contenido: importador de LearnDash con legado auditado (04-business-logic/contenido-y-evaluaciones.md)`
`db: add MediaAsset.captionsSource (05-database/schema.md)`

PR checklist: `pre-commit` (lint + type-check), tests, `pa11y-ci`, sin `any`, docs de
`reference/` actualizados, migración incluida si tocó schema, story si es componente.

## Convención de nombres

Carpetas `kebab-case`. `.ts` en `kebab-case`; servicios con sufijo `.service.ts`. `.tsx` en
`kebab-case` cuando exportan por nombre; PascalCase solo para default exports y para el
sistema de diseño. Hooks `use` + PascalCase.

## Reglas de oro

1. `reference/` primero, código después
2. No dupliques: busca antes de crear
3. Commits atómicos: código + docs
4. Tests obligatorios; `packages/domain` al 90 %
5. TypeScript estricto, cero `any`
6. `withCapability`, no checks manuales
7. `APIError` estándar
8. Atomic design
9. Dark mode + responsive + **accesible**, siempre
10. Design tokens
11. El límite del encargo es el entregable
12. Datos reales de solo lectura
13. SSOT de dominio: se importa, no se reescribe
14. **La mora nunca toca la educación de un menor; adultos, pendiente de asesoría**
15. **Ningún diagnóstico en la base de datos**
