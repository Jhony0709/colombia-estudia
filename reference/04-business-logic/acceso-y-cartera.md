# 04 — Acceso, capacidades y cartera

Este documento manda sobre cualquier implementación. Si el código y este doc difieren,
el código está mal.

## 1. Capacidades con alcance, nunca rol suelto

Ningún endpoint ni componente pregunta `role === 'INSTRUCTOR'`. Se pregunta por una
capacidad **sobre un recurso**. Pertenecer a la misma institución no basta: un estudiante
de la cohorte A no lee un tema de la cohorte B, y un contacto de aliado no ve la cartera
de otra cohorte.

**SSOT**: `packages/domain/src/capabilities.ts`

```ts
type Scope = { institution: true } | { cohortId: string } | { enrollmentId: string } | { partnerId: string }

resolveCapabilities({
  memberships, enrollments, guardianships, partnerContactOf,
  accountStatusByEnrollment, restrictionPolicy, now,
}): Map<Capability, Scope[]>
```

`withCapability(cap, { load, scopeOf })` carga el recurso por id, calcula su alcance y
verifica que esté entre los permitidos. El serializador quita después lo que el rol no
debe ver; **no es** el mecanismo de autorización, es la segunda línea.

| Capacidad              | Quién la tiene                                                                                                                                                                                                                                  | Alcance               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `lesson.read`          | Estudiante con matrícula activa; instructor; admin. (Acudiente: nunca — mira, no estudia; decisión 7 revisada el 23/9)                                                                                                                          | cohorte / institución |
| `lesson.progress.own`  | **Solo** el estudiante de la matrícula: genera evidencia e intentos                                                                                                                                                                             | matrícula             |
| `lesson.author`        | Instructor del programa, admin                                                                                                                                                                                                                  | institución           |
| `lesson.publish`       | Instructor con permiso de publicación, admin                                                                                                                                                                                                    | institución           |
| `assessment.take`      | Estudiante con matrícula activa                                                                                                                                                                                                                 | matrícula             |
| `assessment.grade`     | Instructor, admin: calificar abiertas                                                                                                                                                                                                           | cohorte               |
| `progress.read.cohort` | Operaciones, admin, instructor; contacto de aliado para su cohorte                                                                                                                                                                              | cohorte               |
| `progress.override`    | Operaciones, admin: marcar un tema completado con motivo (auditado)                                                                                                                                                                             | cohorte               |
| `progress.read.ward`   | **Fase C (23/9)**: acudiente sobre cada matrícula de sus pupilos (`Guardianship`). Solo lectura: avance, exámenes con la nota que el estudiante ya puede ver (`reviewPolicy`), notas. Nunca `lesson.read` ni `assessment.take`                  | matrícula             |
| `score.read.own`       | Estudiante. **Sobrevive al vencimiento del acceso** e incluye certificados                                                                                                                                                                      | matrícula             |
| `accommodation.manage` | Coordinación de inclusión, admin                                                                                                                                                                                                                | institución           |
| `billing.manage`       | Operaciones, admin                                                                                                                                                                                                                              | institución           |
| `billing.read.own`     | Quien paga: estudiante adulto (`payerType PERSON`), contacto del aliado si `payerType PARTNER`; **desde el 23/9** también el acudiente con `isFinancialResponsible` sobre la matrícula del pupilo si `payerType PERSON`. Incluye pagar en línea | matrícula / aliado    |
| `people.manage`        | Operaciones, admin: personas, vinculaciones, acudencias, invitaciones, consentimientos en papel                                                                                                                                                 | institución           |
| `cohort.manage`        | Operaciones, admin: cohortes, matrículas y su ciclo de vida, asignaciones, aliados                                                                                                                                                              | institución           |
| `institution.manage`   | Admin: programas, módulos, asignaturas, políticas, auditoría, importación                                                                                                                                                                       | institución           |

En Valida YA hoy solo hay administradores. El rol `INSTRUCTOR` existe para cuando haga
falta; el MVP funciona con `ADMIN` + `OPERATIONS`. `INCLUSION_COORDINATOR` es un rol, no
una pantalla: el admin edita ajustes con el mismo formulario.

Test obligatorio por endpoint con recurso en la URL: **"misma institución, otra cohorte → 403"**.

## 2. La mora y el acceso a la educación

**Para estudiantes menores de edad la regla es absoluta.** La Corte Constitucional, desde
la **SU-624 de 1999** y de forma sostenida (**T-666 de 2013**, entre otras), tiene establecido
que una institución educativa privada **no puede** excluir a un menor de clases por mora,
ni retener certificados o notas como presión de cobro, ni condicionarlos al pago. Para
cobrar tiene la vía civil o ejecutiva.

Por eso, para una matrícula con `isMinorAtEnrollment = true`, las capacidades
`lesson.read`, `assessment.take`, `score.read.own` y la expedición de certificados **nunca
se suspenden por cartera**, y ningún flag de `RestrictionPolicy` puede tocarlas.

**Para estudiantes adultos la relación es más contractual**, y suspender el acceso por no
pago es, en principio, más defendible. **No está verificado con asesoría jurídica.** Hasta
que lo esté:

- `RestrictionPolicy` **no tiene** un flag de suspensión de contenido. No existe como columna.
- Cuando un abogado confirme que procede para adultos, se añade
  `suspendContentAccessForAdults`, que solo aplicará a matrículas con
  `isMinorAtEnrollment = false`, exigirá acuerdo de pago ofrecido previamente, y quedará
  auditado. Es una decisión de Jhonny con respaldo jurídico, no un PR.

> No somos abogados. Lo que sí decidimos como producto es que la plataforma no ofrece un
> botón que un cliente pueda usar contra un menor.

## 3. Lo que sí puede restringirse hoy

`RestrictionPolicy` es por institución, con todo apagado por defecto. Operaciones debe
activar cada flag conscientemente; cada activación queda en `AuditLog`.

| Flag                            | Qué hace                                                                                                                                                                                                     | Riesgo  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `requireAgreementForNextCohort` | Al matricular en una cohorte nueva, exige `PaymentAgreement` vigente si hay cuotas vencidas de una matrícula anterior. Se verifica en `POST /api/cohorts/[id]/enrollments`. Nunca afecta la cohorte en curso | Medio   |
| `notifyPayerOnOverdue`          | (No restringe) Recordatorios a quien paga, por correo y en el centro de notificaciones                                                                                                                       | Ninguno |

Se retiró `hideOptionalActivities` (auditoría fase 0): no existe `Lesson.isOptional` ni
actividades de pago aparte; un flag que no hace nada engaña al que lo activa.

### Etapas por cuota (20/11)

No es un flag de `RestrictionPolicy` ni una suspensión: es qué **abre** cada cuota. Al crear el
plan, operación puede decir qué componentes habilita cada cuota (`Installment.unlockModuleIds`);
por defecto, ninguno.

- Al quedar la cuota `PAID` (`confirmPayment`), sus componentes se habilitan solos
  (`openPaidStages`: `EnrollmentModule` + `AuditLog` `reason: installment_paid` + aviso
  `module_unlocked`).
- Un componente con cuota está bloqueado hasta ese pago, también si es el primero de la ruta.
  Habilitarlo a mano desde la ficha de la matrícula sigue valiendo.
- **Nunca para un menor**: con `isMinorAtEnrollment = true` la lista no se guarda al crear el
  plan y no se lee al calcular el acceso (`stageInstallments`).
- **Sin plan todavía** (programa de pago, adulto, sin `PaymentPlan`): no hay `billing.read.own`,
  así que no ve «Mis pagos»; el inicio lo dice en el módulo de la cuota (`CohortOutline.awaitingPlan`,
  `NoPlanTile`). Sus componentes bloqueados se piden al equipo.
- **Nunca cierra**: una cuota vencida, un pago anulado o una cuota `VOID` no bloquean lo ya
  habilitado. Lo que la persona ya había empezado al crear el plan queda habilitado.
- En un acuerdo de pago, las etapas de las cuotas anuladas pasan a las cuotas nuevas, en orden.

Para adultos sigue pendiente la validación jurídica de §2; la decisión de usarlo es de Jhonny
(`PRODUCT_DECISIONS.md`, 20/11).

### Cerrado por defecto en programas de pago (24/11)

Adulto (`!isMinorAtEnrollment`) en un programa `PAID` y fuera de la vista de estudiante
(`closedByDefault`, `outline.ts`): todos los componentes empiezan `LOCKED`, también el primero, y
la habilitación aplica aunque la cohorte sea `FREE`. Se abren por `EnrollmentModule` (a mano o al
pagar la cuota) o tema por tema por `EnrollmentLesson` (`PUT …/lesson-access/[lessonId]`). Un tema
abierto lleva consigo sus exámenes; un tema con avance o un examen con intentos sigue abierto
sin fila. El curso sigue en la lista del estudiante. Un menor y un programa `FREE`, sin cambios.

## 4. Estado de cuenta: derivado, por matrícula, con `now`

`Account.status` **se calcula** a partir de las `Installment` de la matrícula (solo pagos
**confirmados** cuentan) y del `PaymentAgreement` vigente. Nunca se escribe a mano. Una
persona con dos matrículas tiene dos estados.

```
PARTNER_PAID  el plan lo paga un aliado; el estudiante no tiene cartera propia
CURRENT       ninguna cuota vencida (OPEN y dueOn < now)
IN_AGREEMENT  hay PaymentAgreement ACTIVE y sus cuotas al día
OVERDUE       al menos una cuota vencida sin acuerdo vigente, o cuota del acuerdo vencida
```

`IN_COLLECTION` se marca a mano por operaciones cuando se inicia cobro externo: es el
único estado escrito, y vive en `PaymentAgreement.status = CANCELLED` + nota; se documenta
en el reporte, no bloquea nada.

**SSOT**: `packages/domain/src/account-status.ts`, función pura con `now` como parámetro.
Cualquier pantalla que muestre "al día" o "con cuota vencida" la llama.

`Installment.status` (`OPEN | PARTIALLY_PAID | PAID | VOID`) sí se persiste: es
`f(Σ pagos confirmados no anulados, amount)` y se recalcula **en la misma transacción** que
confirma o anula un pago. En ningún otro sitio.

## 5. Quién paga

`PaymentPlan.payerType`:

- `PERSON` — el estudiante adulto, o el acudiente responsable si es menor.
- `PARTNER` — un aliado paga la cohorte. El estudiante ve "Tu cohorte la financia una
  entidad aliada" en `/aprender` (decisión 8) y no tiene `/aprender/mi-cuenta`; la cartera
  es del aliado, y su contacto la ve con `billing.read.own` sobre su cohorte.

## 6. Acuerdos de pago

Al firmar un `PaymentAgreement`: las cuotas `OPEN`/`PARTIALLY_PAID` pendientes pasan a `VOID`
y nacen cuotas nuevas con `agreementId`, continuando la numeración. `account-status`
devuelve `IN_AGREEMENT` mientras las cuotas del acuerdo estén al día; si una vence, `OVERDUE`
y se notifica. `FULFILLED` cuando todas están `PAID`. Es la evidencia de ánimo de pago que
la jurisprudencia valora, y quien paga debe verlo reflejado.

Registro en dos pasos: vista previa del calendario pactado → confirmación (WCAG 3.3.4).

## 7. Pagos: manual en dos pasos, o en línea

**Manual** (transferencia, Bre-B, efectivo): `POST /api/billing/payments` crea el pago; la
UI muestra un resumen ("Vas a registrar $300.000 por transferencia a la cuota 3 de
{nombre}") y `…/confirm` lo confirma. Un pago equivocado se **anula** (`voidedAt`,
`voidReason`, auditado) y la cuota y el estado se recalculan. Nunca se edita ni se borra.

**En línea** (Bold desde el 18/11; antes Wompi): el estudiante elige la cuota en
`/aprender/mi-cuenta` → `POST …/pay` crea un link de pago de Bold por lo pendiente (un solo
pago, vence en 1 h; queda en `PaymentLink` y se reutiliza mientras siga vigente) y redirige a
él. El pago se registra cuando Bold dice que el link está pagado, y eso se le pregunta al volver
del pago (`?pago=`), al llegar el webhook firmado `POST /api/webhooks/bold` y en el job diario;
el paso del link a `PAID` lo hace una sola vez. Con el monto igual a lo pendiente el `Payment`
se confirma y la cuota se recalcula; con otro monto queda sin confirmar y se avisa a operación.
Los casos, uno por uno, en `06-external-integrations/README.md`. La
comisión de la pasarela la asume quien la institución decida; la UI
muestra ambas opciones y transferencia/Bre-B siguen costando cero.

## 8. Ciclo de vida de la matrícula

```
ACTIVE ──(completó: enrollment-completion.ts)──▶ COMPLETED
ACTIVE ──(retiro por operaciones, con motivo)──▶ WITHDRAWN
```

"Acceso vencido" **no es estado**: es `accessUntil < now` sobre una matrícula `ACTIVE`, y
lo deriva `packages/domain`. Al vencer, `lesson.read` y `assessment.take` se pierden;
`score.read.own` se conserva. `PATCH /api/cohorts/enrollments/[id]` permite `extend
{ accessUntil }` y `withdraw { reason }` (`cohort.manage`, auditado).

Al retirarse: las cuotas no vencidas pasan a `VOID`; las vencidas permanecen (se cobra el
servicio prestado, no el futuro). Repetir cohorte = nueva matrícula, progreso desde cero,
con `requireAgreementForNextCohort` verificado si aplica.

**Menores**: no se matricula un menor sin `Guardianship` previa; el `Consent` del menor lo
firma un acudiente de esa acudencia. La firma sigue siendo **en papel** y operaciones la
registra (`channel PAPER`, `signedById` = el acudiente); `/familia` (Fase C, 23/9) es de
solo lectura y no firma nada. El
menor no entra a `/aprender` sin `Consent` vigente. Se verifica en el servidor.

**`birthDate` es obligatoria para matricular.** El CSV rechaza la fila sin fecha con motivo.
Nunca se asume adulto.

## 9. Vencimientos y recordatorios: derivados + un job diario

Nada cambia de estado "solo" por el paso del tiempo. Acceso vencido, cuota vencida,
acuerdo incumplido e intento vencido se **derivan** con `now`. Lo único programado es un
job diario idempotente (`POST /api/jobs/daily`, Vercel Cron, `CRON_SECRET`) que:

1. envía recordatorios de cuotas vencidas a quien paga, si `notifyPayerOnOverdue`
   (`Notification` con `dedupeKey` + correo);
2. avisa a operaciones de acuerdos con cuota vencida;
3. ~~avisa a autores de `convertUntil` a menos de 14 días~~ (RETIRADO 18/9: el campo ya no existe);
4. cierra intentos `IN_PROGRESS` con `deadlineAt < now` (entrega lo guardado y califica);
5. recuerda sesiones en vivo a 24 h y 1 h;
6. emite certificados de módulos y programas completados desde la última corrida;
7. consulta en Bold los links de pago abiertos y concilia pagos en línea sin confirmar.

Cada corrida escribe un `AuditLog` con conteos. Sin colas, sin workers.
