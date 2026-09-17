# 05 — Datos y migraciones

## Objetivo

Que el schema de `reference/` llegue a Postgres exactamente como está escrito, con lo que
Prisma no expresa, y que cada cambio posterior sea revisable, reversible y ejecutado por
CI.

## Flujo de una migración

```
1. editar prisma/schema.prisma (PR)           ← archivo protegido: confirmación de Jhonny
2. pnpm db:migrate --name <nombre>            ← genera SQL en prisma/migrations/<ts>_<nombre>/
3. editar el SQL si hace falta                ← índices parciales, grants, funciones
4. actualizar reference/05-database/schema.md ← mismo PR
5. CI: migrate deploy en Supabase local + tests de integración
6. merge → deploy.yml: migrate deploy en prod antes del deploy de Vercel
```

Nunca `db push`, nunca `--accept-data-loss`, nunca `migrate reset` fuera de local. Una
migración que borra una columna se hace en dos PRs (dejar de usar → borrar), nunca en uno.

## Lo que Prisma no expresa (en `prisma/sql/`, aplicado por migración)

```sql
-- 001-partial-indexes.sql
CREATE UNIQUE INDEX membership_active_unique ON "Membership"("personId","role") WHERE "revokedAt" IS NULL;
CREATE UNIQUE INDEX attempt_in_progress_unique ON "Attempt"("enrollmentId","assessmentAssignmentId") WHERE status = 'IN_PROGRESS';
CREATE UNIQUE INDEX certificate_program_unique ON "Certificate"("enrollmentId") WHERE kind = 'PROGRAM';
CREATE UNIQUE INDEX person_email_ci_unique ON "Person"("institutionId", lower(email)) WHERE email IS NOT NULL;

-- 002-rls.sql (deny-all para anon/authenticated; el servidor usa service_role)
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;  -- … todas las tablas, generado desde el DMMF
-- sin políticas = nadie salvo el owner/service_role

-- 003-grants.sql (append-only real)
CREATE ROLE app_writer;  -- rol con el que conecta la app (no service_role) en fase 6
REVOKE UPDATE, DELETE ON "AuditLog", "LearningEvent" FROM app_writer;
```

Un script (`packages/scripts/db/gen-rls.ts`) genera `002-rls.sql` desde el DMMF para no
olvidar una tabla nueva; el test de integración lo comprueba.

## Cliente por tenant (`lib/db/tenant.ts`)

```ts
export const db = (institutionId: string) =>
  prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === 'Institution') return query(args);
          if (READ_OPS.has(operation) || UPDATE_OPS.has(operation))
            args.where = { AND: [{ institutionId }, args.where ?? {}] };
          if (operation === 'create') args.data = { ...args.data, institutionId };
          if (operation === 'createMany')
            args.data = args.data.map((d) => ({ ...d, institutionId }));
          if (operation === 'upsert') {
            args.where = { ...args.where, institutionId };
            args.create = { ...args.create, institutionId };
          }
          return query(args);
        },
      },
    },
  });
```

`findUnique` por id se convierte en `findFirst` con `institutionId` (el cliente lo hace).
El cliente base `prisma` solo se importa en `lib/db/tenant.ts`, en el job y en el script
de creación de instituciones (regla depcruise `prisma-solo-en-lib-db`).

## Transacciones

- Pagos: `prisma.$transaction(async tx => { … }, { isolationLevel: 'Serializable' })`:
  crear/confirmar/anular `Payment`, recalcular `Installment.status`, escribir `AuditLog`.
  Reintento automático (3) ante error de serialización.
- Publicación: versión + `LessonVersionAsset` + `AuditLog` en una transacción.
- Intento: iniciar (verificar único `IN_PROGRESS` con el índice parcial; el error de
  unicidad se mapea a `CONFLICT`).
- Cambio de versión de una asignación con `invalidatesProgress`: actualización masiva de
  `LessonProgress` + `Notification` en una transacción.

## Tipos

- `Decimal(12,0)` → `Decimal.js`; en el dominio se usa `bigint` o `number` entero validado;
  el serializador lo convierte a `number` (COP no tiene centavos). Nunca `parseFloat`.
- Fechas `@db.Date` → `YYYY-MM-DD` en la API; comparaciones con `now` en `America/Bogota`
  (`lib/core/dates.ts`, `date-fns-tz`). El job diario corre a las 06:00 Bogotá.
- JSON (`content`, `answers`, `evidence`, `summary`): validado con Zod al escribir y al leer;
  nunca `as any`.

## Semillas

`packages/scripts/seed/`: institución demo, programa con 2 módulos, 4 temas (uno legado),
2 evaluaciones, una cohorte `OPEN` con 5 matrículas (una menor con acudiente en papel,
una de aliado), planes de pago, un acuerdo. **Datos inventados** con `@faker-js/faker` en
`es`. Se usa en local, en tests de integración y en staging.

## Índices para las consultas del MVP

Ya en el schema: `[institutionId, cohortId]` en asignaciones, `[institutionId,
lessonAssignmentId, status]` en progreso, `[institutionId, status, dueOn]` en cuotas,
`[studentId, occurredAt]` en eventos. Se revisan con `EXPLAIN ANALYZE` en fase 6 sobre la
semilla ×10.

## Criterio de salida

- Migración inicial aplicada por CI en staging; `prisma migrate status` limpio.
- Índices parciales presentes (test que intenta violarlos).
- Test de aislamiento por tabla en verde.
- Un pago confirmado dos veces en paralelo deja un solo `Payment` confirmado.
