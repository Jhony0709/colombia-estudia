# Plan — Notificaciones por correo (noviembre de 2026)

Objetivo: que cada persona se entere por correo de lo que le importa de su proceso (matrícula,
acceso, actividades, pagos, constancias) sin tener que entrar a mirar la campana, y que el equipo
reciba lo operativo sin una avalancha. Sin tocar el principio actual: **el aviso en la plataforma es
la fuente de verdad; el correo es un canal más, best effort, que nunca tumba la operación**.

Evidencia = abrí el archivo (`archivo:línea`). Inferencia = va marcada.

## 1. Estado actual

- **Avisos en la plataforma:** `notify` / `notifyMany` crean `Notification` y nada más
  (`features/notifications/server/notifications.service.ts:83-135`). 22 tipos declarados
  (`:26-54`); 21 se emiten (`invitation_failed` no lo emite nadie). Bandeja en `/aprender/notificaciones`,
  `/familia/notificaciones` y `/notificaciones` (staff).
- **El correo ya estaba previsto y quedó a medias:** «crea la fila y, si el tipo lo requiere, encola el
  correo (envío inmediato, best effort, con reintento en el job)» (`plan/06-cohortes-y-personas.md` §7);
  el servicio lo dice: «El job es de una fase posterior» (`notifications.service.ts:9-12`).
- **Correos que salen hoy:** la invitación (`features/auth/server/invitations.service.ts:102`), el
  recordatorio de cuota vencida (`features/jobs/server/daily.service.ts:166-205`, solo con
  `notifyPayerOnOverdue`) y los de Supabase Auth (recuperar, enlace mágico) por SMTP de Resend.
- **Infraestructura reutilizable:** `Mailer` (`lib/mail/mailer.ts`), `ResendMailer` por `fetch`
  (`lib/mail/resend-mailer.ts`), `ConsoleMailer` en desarrollo, `isMailConfigured()` (`lib/mail/index.ts`)
  y el marco de marca `renderBrandedEmail` (`lib/mail/templates/layout.ts:33`).
- **Lo que falta:** cola con reintento, preferencias por persona, enlace de baja, registro de envíos,
  rebotes, y plantillas por tipo.

### Defectos que este trabajo destapa

1. **Recordatorio de mora diario.** `dedupeKey: overdue_reminder:${i.id}:${day(now)}`
   (`daily.service.ts:180`): con la política encendida, el pagador recibe **un correo por cuota y por
   día** mientras siga vencida. Hay que pasar a una cadencia (día 1, 7 y 15, por ejemplo).
2. **Hora en UTC.** «Tu sesión en vivo … empieza el 2026-11-05 14:00 (UTC)»
   (`daily.service.ts:236`). En correo se nota más: debe ir en hora de Bogotá.
3. **«Ya estás matriculado» solo si lo pidió.** `enrollment_created` se emite únicamente cuando la
   matrícula cerró una solicitud (`features/cohorts/server/enrollments.service.ts:388-398`). Quien matricula
   operación a mano no recibe nada.
4. **Cuota de Resend.** Plan Free: 100 correos al día compartidos con Supabase Auth (auditoría A15).
   Con correos por evento se agota el primer día de clases: hay que pasar a Pro antes de encender.

## 2. Clasificación

Cuatro categorías, que son también las preferencias que verá la persona:

| Categoría          | Qué es                                                        | Correo                                                          | ¿Se puede apagar? |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------- | ----------------- |
| **Cuenta y pagos** | Lo que tiene efecto legal o económico, o desbloquea el acceso | Inmediato                                                       | No                |
| **Mi avance**      | Algo cambió en su ruta y probablemente tiene que actuar       | Inmediato                                                       | Sí                |
| **Informativo**    | Bueno saberlo; ya lo ve al entrar                             | No (solo campana) o resumen                                     | Sí                |
| **Operación**      | Trabajo pendiente para el equipo                              | Resumen a las 07:00 y a las 14:00 (Bogotá); urgentes, inmediato | Sí                |

Prioridad: **P0** = sale en la primera versión; **P1** = segunda; **P2** = después o nunca.

### Estudiantes, pagadores y acudientes

| Tipo                  | Dónde se emite                       | Para quién        | Categoría      | Correo                                    | Prioridad                              |
| --------------------- | ------------------------------------ | ----------------- | -------------- | ----------------------------------------- | -------------------------------------- |
| `account_created`     | `registration.service.ts:57` (nuevo) | Quien se registra | Cuenta y pagos | Inmediato                                 | P0                                     |
| `enrollment_created`  | `enrollments.service.ts:391`         | Estudiante        | Cuenta y pagos | Inmediato                                 | P0 (+ emitirlo siempre, defecto 3)     |
| `module_unlocked`     | `module-access.service.ts:264`       | Estudiante        | Mi avance      | Inmediato                                 | P0                                     |
| `submission_returned` | `submissions.service.ts:328`         | Estudiante        | Mi avance      | Inmediato                                 | P0                                     |
| `certificate_issued`  | `certificates.service.ts:285`        | Estudiante        | Cuenta y pagos | Inmediato                                 | P0                                     |
| `payment_confirmed`   | `billing.service.ts:985`             | Pagador           | Cuenta y pagos | Inmediato                                 | P0                                     |
| `payment_failed`      | `account.service.ts:186`             | Pagador           | Cuenta y pagos | Inmediato                                 | P0                                     |
| `overdue_reminder`    | `daily.service.ts:176`               | Pagador           | Cuenta y pagos | Cadencia (defecto 1)                      | P0 cuando se decida la cadencia (§6.5) |
| `live_session_soon`   | `daily.service.ts:234`               | Estudiantes       | Mi avance      | Inmediato (24 h antes)                    | P1 (+ hora de Bogotá)                  |
| `request_dismissed`   | `requests.service.ts:465`            | Estudiante        | Mi avance      | Inmediato                                 | P1                                     |
| `agreement_signed`    | `billing.service.ts:1218`            | Pagador           | Cuenta y pagos | Inmediato                                 | P1                                     |
| `submission_approved` | `submissions.service.ts:328`         | Estudiante        | Informativo    | Solo campana                              | P2                                     |
| `attempt_graded`      | `attempt.service.ts:435`             | Estudiante        | Informativo    | Nada (lo ve al terminar); sí si `expired` | P2                                     |
| `lesson_reopened`     | `assignments.service.ts:336`         | Estudiantes       | Informativo    | Resumen                                   | P2                                     |

Nuevos que conviene emitir (no existen hoy):

- **`account_created` — bienvenida** (P0, Cuenta y pagos, no se apaga): al terminar el registro
  público (`features/auth/server/registration.service.ts:57-168`). Hoy no sale ningún correo al
  registrarse. El texto depende del resultado de la matrícula en la Introducción
  (`RegistrationResult.enrollment`, `:51-54`):
  - `ENROLLED`: «Ya puedes empezar la Introducción», con botón a `/aprender`;
  - `NO_INTRO_COHORT` o `FAILED`: «Tu cuenta está lista; el equipo te escribe para matricularte».

  Lleva además una línea de seguridad: «¿No creaste esta cuenta? Escríbenos». El registro no verifica
  el correo (`email_confirm: true`, `:19-22` y `:95-98`), así que la bienvenida es lo único que avisa
  al dueño real de la dirección si alguien la usó (auditoría A5).

  Para un menor: misma bienvenida, más que para los programas de pago hace falta un acudiente. Sin
  copia a acudiente: al registrarse todavía no hay ninguno vinculado.

  No sale al aceptar una invitación (`invitations.service.ts:142`): esa persona ya recibió el correo
  de invitación. Va también a la campana, como primer aviso.

- **`enrollment_request_received`** (P1): confirmación al estudiante de que su solicitud llegó, con lo
  que sigue («el equipo te escribe»). Hoy solo se le avisa a operación (`requests.service.ts:105-140`).
- **`access_expiring`** (P1): 7 días antes de `accessUntil`. Desde el job diario.
- **Inactividad** (P2): «llevas 10 días sin entrar». Es retención, no transacción: va con la
  categoría Informativo y se puede apagar.

### Equipo

| Tipo                   | Dónde se emite               | Para quién                   | Correo                             | Prioridad |
| ---------------------- | ---------------------------- | ---------------------------- | ---------------------------------- | --------- |
| `reinvite_requested`   | `invitations.service.ts:242` | Operación, admin             | Inmediato (alguien está bloqueado) | P1        |
| `problem_reported`     | `report.service.ts:82`       | Operación, instructor, admin | Inmediato                          | P1        |
| `enrollment_requested` | `requests.service.ts:138`    | Operación, admin             | Resumen 07:00 y 14:00              | P1        |
| `unlock_requested`     | `requests.service.ts:196`    | Operación, admin             | Resumen 07:00 y 14:00              | P1        |
| `submission_received`  | `submission.service.ts:372`  | Instructor, admin            | Resumen 07:00 y 14:00              | P1        |
| `agreement_overdue`    | `daily.service.ts:134`       | Operación, admin             | Resumen 07:00 y 14:00              | P1        |
| `feedback_low`         | `feedback.service.ts:192`    | Operación, admin             | Resumen 07:00 y 14:00              | P2        |

Cada resumen (07:00 y 14:00) es un solo correo por persona con los contadores y enlaces («3 solicitudes de
matrícula, 5 actividades por revisar»), no un correo por aviso.

### Reglas que aplican a todos

- **Menores (decidido):** los de «Cuenta y pagos» y «Mi avance» van también a cada acudiente
  (`Guardianship`, `prisma/schema.prisma:216-228`).
- **No se envía:** a personas anonimizadas (`Person.anonymizedAt`), sin correo, con correo rebotado,
  desde matrículas de prueba (`Enrollment.isPreview`) ni en desarrollo sin `RESEND_API_KEY`.
- **Contenido mínimo:** asunto y una o dos frases con el enlace. Nunca notas, comentarios del
  instructor, ajustes razonables (dato sensible, política §5) ni documentos. El detalle se lee dentro.
- **Fechas y horas** en `America/Bogota` con `packages/domain/src/dates.ts`.
- **Base legal:** la política ya cubre «enviarte avisos sobre tu proceso» (`messages/es-CO.json`,
  `dataPolicy` › finalidades). Lo promocional («nuevos programas») queda fuera de este plan y exige
  baja en un clic.

## 3. Diseño técnico

### 3.1 Registro por tipo (una sola tabla de verdad)

`features/notifications/server/email-policy.ts`: para cada `NotificationType`, su categoría, si va
inmediato, al resumen o no va, si se copia al acudiente y qué plantilla usa. `notify` lo consulta;
ningún sitio decide por su cuenta si manda correo.

### 3.2 Cola (`EmailOutbox`) — 🔒 schema

```prisma
model EmailOutbox {
  id             String      @id @default(cuid())
  institutionId  String
  personId       String
  notificationId String?     @unique
  kind           String      // el NotificationType, o "digest"
  toEmail        String
  subject        String
  html           String
  text           String
  status         EmailStatus @default(PENDING) // PENDING · SENT · FAILED · SKIPPED
  attempts       Int         @default(0)
  nextAttemptAt  DateTime    @default(now())
  lastError      String?
  providerId     String?
  sentAt         DateTime?
  createdAt      DateTime    @default(now())
  @@index([status, nextAttemptAt])
}
```

- `notify` escribe la `Notification` y, si el registro lo pide, la fila de `EmailOutbox` en la misma
  llamada. Se renderiza al encolar: queda constancia de lo que se envió.
- **Envío inmediato:** con `after()` de `next/server` (corre cuando la respuesta ya salió), así la
  operación que lo disparó no espera a Resend. Inferencia: hay que comprobar que `after` funciona en
  los handlers y Server Components donde se llama `notify` (Next 15.5 lo tiene estable).
- **Reintento:** un cron cada 10 minutos (`/api/jobs/mail`, `vercel.json`; el proyecto está en Vercel
  Pro, que lo permite) toma `PENDING` con `nextAttemptAt <= now`, hasta 5 intentos con espera
  creciente (1, 5, 30 min, 2 h, 12 h) y luego `FAILED`.
- **Idempotencia:** cabecera `Idempotency-Key: <outbox.id>` en Resend, para que un reintento tras
  un timeout no duplique.
- **RLS:** la tabla nueva entra con `deny_anon` / `deny_authenticated`, como las demás (B2), y en
  `tenant-isolation.test.ts`.
- **Retención:** el job diario borra `SENT` y `SKIPPED` de más de 90 días (no es append-only).

### 3.3 Preferencias y baja — 🔒 schema

- `NotificationPreference { personId, category, email Boolean }`, sin fila = valor por defecto de la
  categoría. «Cuenta y pagos» no se puede apagar.
- Pantalla «Correos» en `/aprender/mi-cuenta` y en el perfil del equipo.
- Cada correo apagable lleva enlace de baja firmado (HMAC, sin sesión) y las cabeceras
  `List-Unsubscribe` y `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (Gmail y Yahoo las exigen
  a remitentes de volumen).

### 3.4 Rebotes y quejas (P1)

Webhook de Resend (`email.bounced`, `email.complained`), firmado, que marca
`Person.emailUndeliverableAt` y deja de enviar a esa dirección. Operación lo ve en la ficha de la
persona («el correo rebota») para pedir otro.

### 3.5 Plantillas

Una plantilla genérica sobre `renderBrandedEmail` (título, una o dos frases, botón al `href` del
aviso pasando por el login con `next`) y plantillas propias solo donde hace falta: pago confirmado
(monto y cuota), resumen del equipo, constancia. Texto plano siempre. Pruebas de snapshot por plantilla.

### 3.6 Observabilidad

`logger.info({ event: 'mail-sent' | 'mail-failed', kind, outboxId })` sin la dirección. Contador de
`FAILED` en la salud del job diario y alerta de Sentry si pasa de N en una hora (A14).

## 4. Fases

| Fase | Qué entra                                                                                                                                       | Estimación (inferencia) |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| F0   | Resend Pro; registro por tipo; `EmailOutbox` + migración + RLS; envío con `after()`; cron de reintento; plantilla genérica; reglas de exclusión | 3–4 días                |
| F1   | La bienvenida y los 6 tipos P0 de estudiante/pagador (sin mora); defectos 2 y 3; la mora entra cuando se decida su cadencia                     | 2–3 días                |
| F2   | Preferencias + pantalla + baja en un clic; acudientes; P1 de estudiante; urgentes de equipo; resúmenes de las 07:00 y 14:00                     | 3–4 días                |
| F3   | Rebotes y quejas; `access_expiring`; panel de envíos para operación; P2 que se decidan                                                          | 2–3 días                |

Cada fase se prueba en staging con correos a `@example.test` redirigidos (variable
`MAIL_REDIRECT_TO` en staging) antes de producción.

## 5. Pruebas

- Unitarias: el registro (cada tipo tiene política), `notify` encola o no según preferencia,
  exclusiones (anonimizado, prueba, sin correo, rebotado), reintento y espera, firma de la baja.
- Integración (base): `EmailOutbox` en aislamiento por institución; idempotencia del cron.
- E2E: preferencia apagada → no hay fila; enlace de baja sin sesión.
- Plantillas: snapshot HTML y texto; enlaces absolutos al dominio sin `www`.

## 6. Decisiones

Tomadas (Jhonny, 4/11):

1. **Acudientes:** reciben copia de «Cuenta y pagos» y de «Mi avance» cuando el estudiante es menor.
2. **Resumen del equipo:** dos al día, a las 07:00 y a las 14:00 (Bogotá); lo urgente, al momento.
3. **`submission_approved`:** solo campana, sin correo.
4. **Bienvenida al registrarse** (`account_created`): sí, P0, sin baja posible.

Abiertas:

5. **Cadencia de mora:** sin decidir. Mientras tanto `overdue_reminder` no se migra a la cola y
   `notifyPayerOnOverdue` no se enciende en producción: hoy enviaría un correo por cuota y por día
   (defecto 1). Propuesta: días 1, 7 y 15.
6. **`enrollment_created` siempre**, también cuando operación matricula a mano. Propuesta: sí.

## 7. Fuera de alcance

Correos promocionales y campañas; WhatsApp y SMS; notificaciones push; edición de plantillas desde
la plataforma.
