# Auditoría de fase 0 — 14/9/2026

Tres paneles revisaron los 17 documentos y el schema: **PO + CMO**, **CTO + arquitectura +
base de datos**, **UX + accesibilidad**. 48 hallazgos. Aquí lo que se hizo con cada uno.
Los ids son los de los paneles; el detalle completo de cada uno está en el historial de
esta sesión y se resume aquí lo suficiente para no depender de él.

## Aplicados (41)

| Id              | Hallazgo                                                  | Dónde quedó                                                                                                                                         |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| PO-06 / DB-01   | Diez tablas sin `institutionId`                           | Schema: todas las tablas lo tienen; `schema.md` "Decisiones"                                                                                        |
| ARQ-01          | Republicar rompía el progreso y duplicaba el tema         | `LessonAssignment (cohorte, tema)` con versión mutable auditada; `LessonProgress.lessonVersionId`; `invalidatesProgress`                            |
| ARQ-02          | Reglas del intento en el contenedor mutable               | `maxAttempts`, `timeLimitMinutes`, `passPercent`, `reviewPolicy` en `AssessmentVersion`; `attempt-policy.ts` con `dueAt` y `accessUntil`            |
| ARQ-03          | Capacidades sin alcance de recurso                        | `Map<Capability, Scope[]>`; `withCapability` con `load/scopeOf`; test "otra cohorte → 403"                                                          |
| ARQ-04 / PO-04  | Vencimientos sin proceso                                  | Estados derivados con `now`; `POST /api/jobs/daily` (Vercel Cron, `CRON_SECRET`)                                                                    |
| DB-02           | Cuotas del acuerdo como JSON                              | `Installment.agreementId`; pendientes → `VOID`; `account-status` lee solo cuotas                                                                    |
| DB-03           | Cuotas vencidas sin tenant; `status` sin invariante       | `institutionId` + índice; invariante en la transacción del pago; solo confirmados cuentan                                                           |
| DB-04           | Dos intentos abiertos; sin `enrollmentId`                 | `enrollmentId` en `Attempt` y `LessonProgress`; índice único parcial `IN_PROGRESS` (SQL)                                                            |
| DB-05           | Respuestas correctas junto a las preguntas                | `answerKey` aparte, `omit` por defecto, test de no-fuga; `reviewPolicy`                                                                             |
| DB-06           | `asset:<id>` sin relación                                 | `LessonVersionAsset`; `convertUntil` columna; reglas "misma institución" y "READY"                                                                  |
| DB-07           | Sin `onDelete`, sin archivado, sin supresión              | Política `Restrict`/`Cascade` documentada; `archivedAt` en Module, Subject, Partner, MediaAsset, Institution; `Person.anonymizedAt` + procedimiento |
| DB-08           | Vinculación no re-otorgable; email sin unicidad           | Índice único parcial en `Membership` (SQL); `@@unique([institutionId, email])`; límite "una Person por institución" escrito                         |
| DB-09 / UX-05   | `isMinorAtEnrollment` desde `birthDate` opcional          | `birthDate` obligatoria para matricular; CSV rechaza; menor ⇒ acudencia y consentimiento del acudiente                                              |
| DB-10           | `Score` sin regla; catálogos de strings sin lista         | `Score` 0–100 derivado del mejor intento, `sourceAttemptId`; "Catálogos" en `schema.md`                                                             |
| ARQ-05 / PO-02  | Importador no idempotente; fuente insuficiente            | `sourceRef` + `ImportRun`; fuente dump SQL + WXR; dedupe del clon; conteos esperados                                                                |
| ARQ-06          | Webhook de media sin emisor                               | `POST /api/media/[id]/confirm`; sin `MEDIA_WEBHOOK_SECRET`                                                                                          |
| CTO-02          | Datos reales antes que backups/entornos                   | Staging y prod en fase 1; migraciones por CI; Sentry desde el primer handler; regla en `CLAUDE.md`                                                  |
| PO-01           | Secuencia y aprobación sin definir                        | "Secuencia y aprobación" en `contenido-y-evaluaciones.md`; `enrollment-completion.ts`; `Assessment @@unique([moduleId, position])`                  |
| PO-03           | Retiro, completado y repetición sin reglas                | §8 "Ciclo de vida de la matrícula"; `PATCH …/matriculas/[id]`; cuotas futuras `VOID` al retirarse                                                   |
| PO-05 / UX-04   | Sin recuperación de contraseña ni reinvitación            | Rutas y endpoints; invitación en 3 pasos con `Consent PLATFORM`; estados del token                                                                  |
| PO-07           | Flags sin efecto; alcance de más                          | Retirados `hideOptionalActivities` y `simplifiedContent`; `open_text` post-MVP; coordinación de inclusión sin pantalla propia                       |
| PO-08           | Capacidades contradictorias; `TEACHER`                    | `progress.read.cohort`, `lesson.progress.own`, `progress.override`; `INSTRUCTOR` en todo                                                            |
| PO-09           | Sin criterios de aceptación                               | `07-testing-matrix.md` con criterios por fase                                                                                                       |
| PO-10 / A11Y-03 | "Pedir versión accesible" sin destino; sin ayuda          | `POST …/request-accessible` con contador; bloque "Ayuda" con contacto de la institución; patrón de `alt` del legado                                 |
| CMO-01          | Segunda institución no se puede dar de alta               | `Institution` con marca, contacto, política de datos, dominio; `docs/onboarding-institucion.md`; remitente por institución                          |
| CMO-02          | Propuesta de valor inexistente; Q10 como ancla equivocada | `docs/propuesta-de-valor.md`; referencia de mercado corregida                                                                                       |
| CMO-03          | Avance del aliado sin definir; sin métricas               | `04-business-logic/reportes.md`; exportaciones CSV; `GET /api/inclusion/report`                                                                     |
| CMO-04 / UX-08  | Nombres que confunden; enums sin etiqueta                 | Columnas UI/Venta en el glosario; tabla "Etiquetas de estados"                                                                                      |
| UX-01           | Estados de matrícula sin pantalla; bucle de redirección   | Columna "Estados" en `routes.md`; `/sin-acceso`; regla anti-bucle                                                                                   |
| UX-02           | Intento vencido pierde respuestas; sin confirmación       | Vencido con respuestas → `SUBMITTED` y calificado; autosave con cola; pantalla previa; confirmación; `deadlineAt` del servidor                      |
| UX-03           | Progresión lineal sin salida                              | Evidencia por forma de contenido; "Reportar un problema"; `progress.override`                                                                       |
| UX-06           | El acudiente generaba evidencia por el menor              | `lesson.progress.own` solo para el estudiante; `/familia` solo lectura con aviso                                                                    |
| UX-07           | Pago en un paso, sin reverso                              | Dos pasos; `Payment.voided*`; recálculo en la transacción                                                                                           |
| A11Y-01         | Criterios AA faltantes                                    | Filas nuevas en el contrato: reflow, text spacing, skip link, títulos, foco, trampa de teclado, autocomplete, 3.3.4, 2.5.3, 4.1.3                   |
| A11Y-02         | Subtítulos automáticos contaban como subtítulos           | `captionsSource NONE/AUTO/REVIEWED`; contrato del player; transcripción como evidencia                                                              |
| A11Y-04         | Sin fórmulas                                              | `$…$` LaTeX → MathML en el contrato                                                                                                                 |
| A11Y-05         | Sin `lang` en fragmentos                                  | `Lesson.language`, `:lang[]{}`; aviso en lecciones de Inglés                                                                                        |
| A11Y-06         | Cronómetro en región viva; `Notification` sin superficie  | `role="timer"` + hitos; centro de notificaciones con `dedupeKey`                                                                                    |
| A11Y-07         | Editor sin contrato; preguntas sin reglas                 | Contrato del editor; tabla de validación de evaluaciones; normalización de `short_text`                                                             |
| A11Y-08         | Tokens prometidos sin doc; estado solo por color          | `03-ui/tokens.md` contrato; regla icono + texto; `DESIGN.md`                                                                                        |
| CTO-01          | Sin plan de corte ni rollback                             | Plan en fase 6; `ProgressSource.IMPORTED`; decisión 1 pendiente (A/B)                                                                               |

## Descartados o parcialmente aplicados (7), con motivo

| Id                                 | Qué proponía                                                          | Qué se hizo y por qué                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-01 (FK compuestas)              | `@@unique([id, institutionId])` en cada padre + relaciones compuestas | Solo la columna desnormalizada + índice. Las FK compuestas hacen cada relación verbosa en Prisma; el test por tabla cubre el riesgo. Quedan para endurecimiento |
| PO-07 (`/familia` fuera del MVP)   | Recortar acudiente                                                    | Depende de si hay menores en la cohorte de lanzamiento → decisión 7                                                                                             |
| PO-07 (`Notification` fuera)       | Eliminar la tabla                                                     | Se conserva con centro de notificaciones: el correo de muchos migrados no es fiable (A11Y-06 lo argumenta mejor)                                                |
| PO-07 (`Score` aplazado)           | Derivar sin tabla                                                     | Se persiste derivado con `sourceAttemptId`: hace falta para reportes y exportación                                                                              |
| CMO-01 (dominio)                   | Subdominio en MVP                                                     | Documentado como recomendación; decisión 3                                                                                                                      |
| A11Y-03 (OCR sin revisar expuesto) | Mostrar texto automático                                              | Decisión 5                                                                                                                                                      |
| UX-03 (`FREE` para adultos)        | Cambiar la progresión por defecto                                     | Se mantiene `LINEAR` (es lo que Valida YA usa); `FREE` existe y es por cohorte                                                                                  |

## Lo que cambia para quien retome el proyecto

El schema pasó de 30 a 32 modelos con la auditoría (35 después, con `Submission`,
`LiveSession` y `Certificate` de la paridad con Zona 57) y cambió en profundidad; `reference/` se reescribió
casi entero. **No hay que releer esta sesión**: `docs/handoff.md` trae el estado.
