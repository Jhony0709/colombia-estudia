# 06 — Institución, cohortes y personas (fase 2, semanas 4-5)

## Objetivo

Que operaciones pueda, sin ayuda del desarrollador: configurar la institución, crear una
cohorte, cargar 100 personas desde un archivo con errores claros, invitarlas y ver quién
aceptó. Todo auditado.

## Pasos

### 1. Institución (`/admin/institucion`)

Formulario en dos pantallas: marca y contacto (nombre, logo, color con contraste
verificado en vivo, correo y teléfono de soporte, nombre del remitente) y datos legales y
política (nombre legal, NIT, URL y versión de la política de datos). Cambiar
`dataPolicyVersion` avisa: "los consentimientos existentes quedan con la versión anterior".
`PUT /api/admin/institution` → `AuditLog institution.updated`.

### 2. Programa, módulos, asignaturas

CRUD simple con orden por arrastre **y** botones "subir/bajar" (regla de arrastre). Un
módulo no se borra si tiene temas (`Restrict`); se archiva.

### 3. Cohortes (`/cohortes`)

Crear (`code`, nombre, programa, fechas, aliado opcional, progresión) → `PLANNED`. **Abrir**
crea las asignaciones con las versiones publicadas vigentes (transacción) y pasa a `OPEN`;
si un tema no tiene versión publicada, se lista y no se abre. Cerrar → `CLOSED` (no
matricula más; los inscritos siguen hasta `accessUntil`).

### 4. Personas (`/personas`)

Lista sin PII sensible (nombre, correo enmascarado, roles, estado de invitación). Detalle
con PII → `AuditLog person.pii_read`. Roles como chips añadir/revocar (auditado).
Acudencias para menores; consentimiento en papel (`PAPER`, adjunto opcional como
`MediaAsset DOCUMENT`).

### 5. Carga CSV en tres pasos (`/cohortes/[id]/importar`)

**Plantilla** descargable (`documentType, documentNumber, givenName, familyName,
birthDate, email, phone, guardianDocumentType*, guardianDocumentNumber*, guardianGivenName*,
guardianFamilyName*, guardianEmail*, guardianRelationship*, payerType, totalAmount,
installments`) con una fila de ejemplo y un `README` en la primera hoja.

**Validación en seco** (`POST …/import?dryRun=true`): parse en streaming (`papaparse`),
Zod por fila, reglas de dominio (fecha de nacimiento obligatoria; menor ⇒ columnas de
acudiente; correo único en la institución; documento único; persona existente → se
reutiliza y se informa; `requireAgreementForNextCohort`). Respuesta: tabla de errores por
fila y columna con mensaje y arreglo; resumen "55 se importarán, 5 con errores". La
pantalla lo muestra con `role="alert"` resumido y enlace a cada fila; se puede descargar
el CSV de errores para corregir en Excel.

**Confirmar**: mismo archivo, `dryRun=false`, **todo o nada** en una transacción: personas,
acudencias, matrículas (`isMinorAtEnrollment`, `accessUntil`), planes de pago y cuotas si
vienen. `AuditLog import.run` con el resumen. Nada de invitaciones aquí.

### 6. Invitaciones

Paso separado: "Enviar invitaciones a 55 personas" con confirmación. Plantilla de correo
por institución (Resend, texto plano + HTML accesible, en español, con el nombre de la
institución y el enlace). Estado por persona: pendiente / vencida / aceptada; reinvitar
invalida el token anterior. Envío en lotes de 20 con `Promise.allSettled` y registro de
fallos; sin colas.

### 7. Notificaciones

`features/notifications`: `notify(ctx, { personId, type, title, body, href, dedupeKey })`
crea la fila y, si el tipo lo requiere, encola el correo (envío inmediato, best effort,
con reintento en el job). `/notificaciones` con lista, marcar leída, y campana con
contador en texto ("3 sin leer").

### 8. Ciclo de la matrícula

`PATCH /api/cohorts/enrollments/[id]`: `withdraw { reason }` (cuotas no vencidas → `VOID`,
auditado), `extend { accessUntil }`. Pantalla de detalle con las tres pestañas: progreso,
ajustes, cartera.

## UX que importa aquí

Operaciones trabaja en portátil con una hoja de cálculo al lado: tablas con filtros
persistentes en la URL, acciones por fila, confirmaciones con resumen, exportar CSV en
cada tabla. Ningún borrado: archivar, retirar, revocar. Estados vacíos que dicen qué hacer
("Aún no hay cohortes. Crea la primera.").

## Criterio de salida

- CSV de 60 personas con 5 filas inválidas: seco lista las 5 con motivo, confirmar
  importa 55, < 2 minutos; fila sin `birthDate` rechazada; menor sin acudiente rechazado.
- Abrir una cohorte crea N asignaciones; un tema sin versión publicada lo impide con
  mensaje.
- Invitación aceptada por teclado y VoiceOver en iOS; reinvitar invalida la anterior.
- `AuditLog` con `import.run`, `person.pii_read`, `membership.granted`, `enrollment.created`.
