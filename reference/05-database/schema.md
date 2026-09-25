# 05 — Modelo de datos

Implementado en `prisma/schema.prisma`. Este doc explica el porqué; el `.prisma` es el qué.
Si cambias uno, cambias el otro en la misma PR.

## Mapa

```
Institution ─┬─ Person ─┬─ Membership (rol)
   (tenant,  │          ├─ Guardianship (solo menores)
    marca)   │          └─ Consent (firma el propio adulto o el acudiente)
             ├─ Partner (aliado B2B)
             ├─ Program ─┬─ Module ─┬─ Lesson ─ LessonVersion ─ LessonVersionAsset ─ MediaAsset
             │           │          └─ Assessment ─ AssessmentVersion (content + answerKey)
             │           └─ Cohort ─┬─ LessonAssignment (cohorte, tema) ─ LessonProgress
             │                      ├─ AssessmentAssignment (cohorte, evaluación) ─ Attempt
             │                      └─ Enrollment ─┬─ PaymentPlan ─ Installment ─ Payment
             │                                     ├─ PaymentAgreement ─ Installment
             │                                     ├─ Accommodation (PIAR ejecutable)
             │                                     └─ Score (por asignatura)
             │           └─ Cohort ─┬─ LiveSession (clase en vivo)
             │                      └─ Enrollment ─┬─ Submission (entrega de actividad)
             │                                     └─ Certificate (constancia, código público)
             ├─ Subject
             ├─ LearningEvent (append-only)
             ├─ RestrictionPolicy
             ├─ ImportRun
             ├─ AuditLog (append-only)
             └─ Notification
```

## Decisiones que no son obvias

**`institutionId` en TODAS las tablas del negocio, también en las hijas.** Desnormalizado
a propósito: el cliente Prisma extendido (`apps/web/lib/db/tenant.ts`) lo inyecta en cada
`where` sin joins, y el test de aislamiento cubre cada tabla, no "las que lo tienen".
Cuesta una columna e índice por tabla; evita la clase de bug que no se detecta hasta que
hay dos clientes. Las FK compuestas `(id, institutionId)` quedan como refuerzo opcional
para la fase de endurecimiento.

**`Program → Module → Cohort`, no grados y años lectivos.** Valida YA vende un programa en
cohortes de ~6 meses, varias al año, algunas de aliados. La cohorte es la unidad comercial
y académica; el módulo ("Mes 1") ordena el contenido y sus evaluaciones.

**`Person` sin `role`, sin `blocked`, y nunca se borra.** Roles en `Membership` (re-otorgable:
índice único parcial sobre `revokedAt IS NULL`); estado de cuenta derivado; supresión =
`anonymizedAt` + procedimiento que vacía la PII conservando el id (los `AuditLog`,
`LearningEvent` y `Attempt` siguen apuntando a una persona anónima).

**Una `Person` por institución** (`authUserId` único global). Límite aceptado: la misma
persona en dos instituciones exige refactor a `Person` global + pertenencia por
`Membership`. Se hace antes de la segunda institución, no ahora.

**`Enrollment.isMinorAtEnrollment` se congela**, y `birthDate` es obligatoria para
matricular aunque sea opcional en `Person` (un contacto de aliado no la necesita).

**Lo publicado es inmutable; la asignación es (cohorte, tema).** `LessonVersion` y
`AssessmentVersion` no se editan. `LessonAssignment` apunta a una versión que puede cambiar
(auditado); `LessonProgress.lessonVersionId` recuerda con cuál se recogió la evidencia;
`Attempt.assessmentVersionId` es el snapshot del intento. Ver `contenido-y-evaluaciones.md`.

**Las reglas del intento viven en la versión.** `maxAttempts`, `timeLimitMinutes`,
`passPercent`, `reviewPolicy` en `AssessmentVersion`: cambiar el umbral en mayo no reescribe
quién aprobó en marzo.

**`answerKey` separado de `content`** y excluido del cliente Prisma por defecto (`omit`).
La única lectura es `grading.ts`. Un `include` olvidado no filtra las respuestas.

**Contenido en Markdown, recursos en `MediaAsset`, unión en `LessonVersionAsset`.** La
tabla de unión se llena al publicar: impide borrar un recurso en uso (`Restrict`), garantiza
misma institución y hace consultable qué recurso usa cada versión sin parsear Markdown.

**`captionsSource` distingue `AUTO` de `REVIEWED`.** Los subtítulos automáticos de Vimeo con
vocabulario de Física no cumplen WCAG 1.2.2; no cuentan para publicar ni para `requiresCaptions`.

**Preguntas como JSON en la versión.** Deliberado; ver `contenido-y-evaluaciones.md`.

**`Attempt.appliedAccommodation` congela los ajustes.** Ver `ajustes-razonables.md`.

**Estados por tiempo se derivan, no se persisten.** Acceso vencido, cuota vencida, acuerdo
incumplido: funciones puras con `now`. Lo único escrito por el paso del tiempo lo hace el
job diario (intentos vencidos), con `AuditLog`.

**`Account` no es tabla.** `account-status.ts` la deriva por matrícula.

**Cuotas de acuerdo como filas, no JSON.** Al firmar, las pendientes pasan a `VOID` y nacen
`Installment` con `agreementId`. Un `Payment` siempre apunta a una cuota real.

**`Installment.status` se persiste con invariante**: `f(Σ pagos confirmados no anulados,
amount)`, recalculado en la transacción del pago. Montos `Decimal(12,0)`: pesos enteros;
Prisma los devuelve como `Decimal.js`, nunca `number`.

**`Score.recordedById` nulo = derivado por `grading.ts`**; con valor = corrección manual
auditada. **`Certificate`**: índice único parcial en SQL para `PROGRAM` (el `@@unique` con
`moduleId` nulo no lo garantiza).

**`sourceRef` + `ImportRun`**: importación idempotente por `learndash:<post_type>:<id>`,
con `dryRun` y resumen. La segunda ejecución actualiza, no duplica. Solo contenido
(decisión 1).

**`Submission`, `LiveSession`, `Certificate`** entraron por paridad con la propuesta
competidora. `Certificate.code` es público y único; se emite solo (job diario) y se revoca
con motivo; nunca depende de la cartera. `Payment.gatewayRef` único hace idempotente el
webhook de Wompi.

**`RestrictionPolicy` no tiene flags académicos** ni flags sin efecto. Ver `acceso-y-cartera.md`.

**`LearningEvent`, `AuditLog` append-only.** Sin `updatedAt`, sin `DELETE`; rol de BD sin
UPDATE/DELETE sobre ellas en la fase de endurecimiento.

## Códigos legibles (25/9)

`Person`, `Module`, `Lesson` y `Assessment` llevan `code` (`PER-0001`, `COM-0001`, `TEM-0001`,
`EXA-0001`), único por institución. Lo asigna la base, no el servicio: la tabla `Counter`
(`institutionId`, `name`, `seq`) y la función `next_code()` incrementan de forma atómica
(`INSERT … ON CONFLICT … RETURNING`), y el trigger `assign_code` BEFORE INSERT rellena la
columna cuando llega vacía. Está en la base porque una persona la crean el registro, el
import, los scripts y el seed: un camino que se olvide de pedir el código dejaría filas sin
él. En Prisma la columna es `String @default(dbgenerated("''::text"))`, así `create()` no lo
pide y lo devuelve ya asignado. Patrón Basikon (`Counter` + `formatRegistration`). `Program`
y `Cohort` conservan su `code` manual.

## onDelete

Por defecto `Restrict` (el de Prisma para relaciones obligatorias): borrar un módulo con
temas falla, y está bien. `Cascade` solo en hijos puros: `LessonVersionAsset` (desde la
versión) y `Notification` (desde la persona). Todo lo demás se **archiva** (`archivedAt`) o
se anonimiza, nunca se borra.

## Datos sensibles

| Dato                             | Dónde                               | Regla                                                                                            |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Documento, fecha de nacimiento   | `Person`                            | Ley 1581. Solo roles administrativos; lectura del detalle en `AuditLog`                          |
| Diagnóstico o condición de salud | **En ninguna parte**                | `Accommodation` guarda el ajuste, nunca la causa                                                 |
| Respuestas correctas             | `AssessmentVersion.answerKey`       | `omit` por defecto; solo `grading.ts`; test de no-fuga en `/api/learn/*`                         |
| Estado de cuenta                 | Derivado                            | Solo quien paga y operaciones. Nunca instructores ni otros estudiantes                           |
| Datos de un aliado               | `Partner`                           | Un contacto de aliado ve solo su cohorte                                                         |
| Política de datos                | `Institution.dataPolicyUrl/Version` | Cada institución es responsable del tratamiento; la plataforma, encargada (contrato por cliente) |

## Retención y supresión

Solicitud de supresión (Ley 1581): `Person.anonymizedAt`, se vacían `givenName` ("Persona"),
`familyName` ("anonimizada"), documento, email, teléfono, `birthDate`, `authUserId` (y se
borra el usuario en Supabase Auth); `Consent.revokedAt`; se conservan `Attempt`, `Score`,
`LearningEvent`, `AuditLog`, cartera (obligación contable). Procedimiento con `AuditLog`.

## Catálogos (literales en `packages/types`, no enums de Postgres)

- `LearningEvent.type`: `lesson.opened`, `lesson.video.progress`, `lesson.transcript.read`,
  `lesson.scrolled_to_end`, `lesson.completed`, `attempt.started`, `attempt.answer.saved`,
  `attempt.submitted`, `attempt.graded`, `assessment.blocked_view`, ~~`accessible.requested`~~
  (RETIRADO 18/9, con `POST …/request-accessible`), `problem.reported`.
- `AuditLog.entity/action`: `institution.{created,updated}`, `enrollment.{created,withdrawn,extended,completed}`,
  `certificate.{issued,revoked}`, `submission.{approved,returned}`, `live_session.{created,updated}`,
  `assignment.version_changed`, `lesson_version.published`,
  `accommodation.{created,updated}`, `payment.{confirmed,voided}`, `agreement.{signed,fulfilled,cancelled}`,
  `policy.updated`, `membership.{granted,revoked}`, `person.{pii_read,anonymized}`,
  `progress.override`, `import.run`, `job.daily`, `invitation.{sent,accepted}`.
- `Notification.type`: `overdue_reminder`, `agreement_overdue`, `attempt_graded`,
  `lesson_reopened`, ~~`accessible_ready`~~ (RETIRADO 18/9), `problem_reported`,
  `submission_reviewed`, `submission_received`, `live_session_soon`, `certificate_issued`,
  `payment_confirmed`.

Añadir un literal = PR que toca el catálogo y este doc, sin migración.

## RLS

Activo en todas las tablas como **defensa en profundidad**: políticas que deniegan todo a
`anon` y `authenticated`; el cliente nunca consulta Postgres directo. Razones en
`PRODUCT_DECISIONS.md`.

## Invitaciones (añadido en fase 1)

`Invitation { id, institutionId, personId, tokenHash, expiresAt, acceptedAt, createdById, createdAt }`
para invitaciones y reinvitaciones con historial. El token se hashea antes de guardar. Reinvitar
crea una nueva fila; `acceptedAt` marca que se usó.

## Pendiente (no MVP)

`Competency` / DBA desde `learningObjective`; contrato de aliado que agrupe cuotas;
`Lesson.isOptional`; variante simplificada de una versión; `Person` global
multi-institución; FK compuestas por tenant; login de acudiente (`/familia`).
