# Plan — Redefinición tras la reunión del 20/9

Lo que los clientes pidieron (transcripción del 20/9), por fases, con lo que cada una toca
y lo que cada una necesita de quién. El orden es el que acordamos: primero que el
administrador funcione como el negocio; el diseño después.

| Fase | Qué                                              | Toca schema | Necesita de los clientes                 |
| ---- | ------------------------------------------------ | ----------- | ---------------------------------------- |
| A    | Estructura: examen por tema y grado de entrada   | Sí (2 cols) | Nombres de los 10 módulos (cuando estén) |
| B    | Registro público y módulo de introducción gratis | No          | Nombre del módulo de introducción        |
| C    | Cuenta del acudiente (solo lectura)              | No (domain) | —                                        |
| D    | Portada: técnicos laborales e inglés             | No          | Lista de técnicos y URL del Politécnico  |
| E    | Cobro por módulo y nota condicionada a pago      | Sí          | **Asesoría jurídica** antes de construir |

## Fase A — La estructura tal como la operan

**Modelo**: un solo programa de bachillerato con 10 módulos («Matemáticas 1», …), cada
módulo con 4-7 temas, cada tema con información + actividad con entrega + examen. Quien
entra desde 8° o desde 10° ve el mismo programa desde el módulo que le toca. El módulo de
introducción es un programa aparte (Fase B).

1. **Examen por tema**: `Assessment.lessonId String?` (nullable). Con `lessonId`, la
   evaluación es «el examen de ese tema» y la secuencia la pone justo después del tema y
   antes del siguiente; sin `lessonId` sigue como hoy, al final del módulo. Cambian
   `outline.ts` (`sortItems`/`sequence`), `enrollment-completion.ts` (el módulo se completa
   con sus temas y sus exámenes, como ya), el formulario de crear evaluación (selector
   «Tema» opcional dentro del módulo) y `/aprender` (el examen se pinta debajo de su tema).
2. **Grado de entrada por matrícula**: `Enrollment.startsAtModule Int?` (posición del primer
   módulo visible; nulo = todos). Se elige al matricular («Empieza en: Módulo 5 —
   Matemáticas 2»). `getCohortOutline` oculta los módulos anteriores y los cuenta fuera del
   avance; `openCohort` sigue asignando todo (la asignación es de la cohorte, la vista es de
   la matrícula); constancias y `isEnrollmentCompleted` miran solo los módulos visibles; el
   plan de pagos ya es por matrícula, así que el precio distinto sale al crear el plan.
3. Las asignaturas se quedan como la materia madre (Matemáticas → Matemáticas 1 y 2); la
   nota por asignatura (`Score`) se deriva igual. Decisión pendiente con ellos: si quieren
   «nota por módulo» además.

**Migración**: `prisma/migrations/2026092X_assessment_lesson_and_entry_module` con las dos
columnas y un índice sobre `Assessment.lessonId`. Sin datos que migrar.

## Fase B — Registro público y módulo de introducción

**Hecha el 23/9** (`docs/estado.md` «23/9 — Fase B»). Desviaciones: se pide fecha de nacimiento (sin ella no hay matrícula ni se sabe quién firma la política); contraseña ≥12, como la invitación, no 8.

1. `/registro` (público, con límite por IP): nombre, apellido, correo, teléfono, contraseña
   elegida por la persona (mínimo 8). Crea `Person`, usuario de Auth, membresía `STUDENT` y
   la matrícula en la **cohorte de introducción** (`Institution.settings.introCohortId`,
   elegida en `/admin/institucion` entre las cohortes abiertas). Sin cohorte configurada,
   el registro crea la persona y avisa que operación la matriculará.
2. Botón «Regístrate» en la portada y en el login.
3. Operación crea cuentas «por la persona» con lo que ya existe: crear la persona en
   `/personas` y enviar la invitación (enlace de 7 días). **No** se implementa la clave
   «nombre + dos últimos dígitos de la cédula»: adivinable en dos intentos y usa un dato
   personal (Ley 1581). Alternativa equivalente en fricción: el enlace.
4. `docs/onboarding-institucion.md` §Registro.

## Fase C — Cuenta del acudiente

**Hecha el 23/9** (`docs/estado.md` «23/9 — Fase C»). La capacidad se llama `progress.read.ward` y se resuelve por matrícula del pupilo (`wardEnrollments`); `billing.read.own` solo con `isFinancialResponsible` y `payerType PERSON`.

1. `packages/domain/src/capabilities.ts`: nueva capacidad `progress.read.ward` con alcance
   `{ enrollmentId }` por cada matrícula de cada `Guardianship` del acudiente; y
   `billing.read.own` sobre esas matrículas cuando `isFinancialResponsible`. La decisión 7
   («GUARDIAN sin capacidades académicas») se revisa: lectura, nunca acción.
2. Área `(familia)`: `/familia` (lista de hijos con porcentaje y estado) y
   `/familia/[enrollmentId]` (avance por módulo, notas según `reviewPolicy`, cuotas si es el
   responsable). Misma `SideNav`. `/ingresar` manda a `GUARDIAN` a `/familia`.
3. Alta del acudiente: `/personas/[id]` → «Acudencia» ya existe; se añade «Enviar
   invitación» al acudiente desde ahí.

## Fase D — Portada

Sección «Técnicos laborales» (lista de programas del Politécnico de Cundinamarca, solo
nombres, botón que lleva a su sitio) y «Inglés en vivo» (promoción, contacto por WhatsApp).
Contenido en `features/marketing/content.ts`; sin backend.

## Fase E — Cobro por módulo y nota condicionada (no se construye todavía)

Lo que pidieron: ver la nota solo con la mensualidad al día, y habilitar módulos a medida
que se pagan (con desbloqueo automático al confirmar el pago). Lo que dice el repo: la mora
nunca toca el acceso académico de un **menor** (`prisma/schema.prisma` §RestrictionPolicy,
jurisprudencia constitucional), y para adultos no existe suspensión hasta la asesoría
jurídica (`acceso-y-cartera.md` §2). Como matriculan desde 6°, puede haber menores.

Diseño listo para cuando haya luz verde jurídica, solo para adultos:
`RestrictionPolicy.hideScoresWhenOverdue`, `RestrictionPolicy.unlockModulesOnPayment`,
`Installment.moduleId String?`; en `confirmPayment` (que ya llaman el pago manual y el
webhook de Wompi) se habilita el módulo ligado; el estudiante ve «Este módulo se habilita
con la cuota N» en vez de un candado mudo. Ellos mismos lo aplazaron a la fase de finanzas.

## Lo que ya existe y solo hay que enseñarles

Estado de cuenta y fechas en `/aprender/mi-cuenta`; recordatorio diario por cuota vencida
(notificación + correo) con `notifyPayerOnOverdue` en `/admin/politicas`; pago en línea
cuando estén las llaves de Wompi.
