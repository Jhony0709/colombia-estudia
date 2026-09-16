# 08 — Aprender y evaluar (fase 4, semanas 10-13)

## Objetivo

Un estudiante adulto, desde su celular, recorre el programa de punta a punta: ve su
cohorte, estudia un tema con video y texto, deja evidencia, presenta una evaluación con
sus ajustes y sin perder respuestas, entrega una actividad, asiste a una clase en vivo,
recibe su constancia. Todo con teclado y lector de pantalla.

## Pasos

### 1. `/aprender` (la ruta del programa)

`GET /api/learn/cohort` devuelve módulos → temas y evaluaciones con `status`,
`enabled`, `blockedBy` (calculado por `lesson-completion` + secuencia). UI:
`ProgramOutline` (organism): módulos como secciones colapsables (acordeón accesible), cada
tema una fila presionable con `StatusChip` (icono + texto), el bloqueado dice "Se habilita
al completar {tema}". Arriba: "Continuar donde ibas" (primer tema `IN_PROGRESS` o el
siguiente habilitado). Estados terminales según `routes.md`. Línea "Tu cohorte la financia
una entidad aliada" si aplica.

### 2. Player (`/aprender/tema/[assignmentId]`)

Server Component que trae `GET /api/learn/lessons/[id]` (Markdown ya renderizado en el
servidor con `renderContent`, assets con URLs firmadas, ids de Vimeo). Estructura:
`h1` → aviso de legado si aplica → `VideoPlayer` → contenido a `readingWidth` → barra de
acciones fija abajo (`touchMin`): Anterior · Marcar como visto (solo si la evidencia lo
permite) · Siguiente.

`VideoPlayer` (organism): iframe de Vimeo con `title`, "Saltar el video" antes, SDK
`@vimeo/player` para `timeupdate` (evidencia cada 10 s, throttled) y `setCurrentTime` desde
la transcripción; transcripción VTT parseada en bloques-botón sincronizados (resaltado del
bloque actual con `aria-current`), `<details open>`; "Ver solo la transcripción" no
monta el iframe. Con `requiresCaptions` y sin subtítulos revisados: no monta el iframe,
muestra la transcripción o el aviso + "Pedir versión accesible".

Evidencia: `POST …/evidence` con `{ videoPositionSeconds | transcriptReadToEnd |
scrolledToEnd, secondsOnLesson }`, debounced, con cola local (IndexedDB) si no hay red y
reintento al volver; el servidor decide `COMPLETED` y devuelve el nuevo estado; la UI lo
anuncia (`useAnnounce`). `LearningEvent` en cada evidencia.

Tema `requiresSubmission`: formulario de entrega (texto y/o archivo) con estado
(`SUBMITTED` "Enviada, en revisión" / `RETURNED` con feedback y reenvío / `APPROVED`).

"Reportar un problema" → `POST …/report` con motivo de una lista + texto.

### 3. Motor de intentos (`features/learn/attempts`)

Máquina de estados en el servidor (`packages/domain/src/attempt-policy.ts` + servicio):

```
start   → verifica habilitación, intentos disponibles, único IN_PROGRESS (índice parcial),
          congela appliedAccommodation, calcula deadlineAt, crea Attempt, LearningEvent
answer  → PATCH idempotente por questionCode; rechaza si deadlineAt < now (410) o status ≠ IN_PROGRESS
submit  → grading.ts sobre answerKey; status GRADED; Score derivado; LearningEvent; Notification
expire  → job diario (y también al primer request tras deadlineAt): con respuestas → submit; sin → EXPIRED
```

UI `AttemptPlayer` (organism): pantalla previa (intentos restantes, tiempo ya ajustado,
"no podrás pausar", botón "Empezar"); una pregunta por pantalla en móvil (todas en una
columna en escritorio), navegación "anterior/siguiente" y lista de preguntas con estado
(respondida / sin responder); `role="timer"` con `deadlineAt` del servidor (el cliente
solo muestra; corrige deriva con el header `Date`), ocultable, hitos por `useAnnounce`;
autosave por respuesta con cola local y estado "Guardado 12:41" / "Sin conexión: se
guardará al reconectar"; entrega con diálogo que lista las sin responder; resultado según
`reviewPolicy`, anunciado.

Fieldset por pregunta (`legend` = enunciado con "Pregunta 3 de 10" como `h2` encima),
radios/checkboxes nativos estilizados, `aria-describedby` para la ayuda, MathML en
enunciados y opciones, `:lang` en preguntas de Inglés.

### 4. Entregas (`/cohortes/[id]/entregas`)

Cola por cohorte: filtros por estado y tema; detalle con el archivo (URL firmada,
`attachment`) y el texto; aprobar (completa el tema con `EVIDENCE`) o devolver con
comentario obligatorio; ambos notifican. `assessment.grade`.

### 5. Sesiones en vivo

CRUD en `/cohortes/[id]` (título, fechas, URL, descripción); `/aprender/calendario` las
muestra junto a `dueAt` y fechas de cohorte, con "Unirse" activo desde 15 min antes; el
job avisa a 24 h y 1 h (`Notification live_session_soon` + correo). Grabación: el autor
registra el video de Vimeo y lo asocia (`recordingId`); aparece en la biblioteca.

### 6. Certificados

Job diario: por cada matrícula `ACTIVE`, `enrollment-completion.ts` decide módulos
completados sin `Certificate MODULE` → emite; matrícula completa → `COMPLETED` +
`Certificate PROGRAM` (índice parcial garantiza uno). `code` = 10 caracteres
alfanuméricos sin ambigüedad (sin 0/O/1/I). `/certificado/[code]`: página pública con
nombre, programa, módulo, institución, fecha, estado (vigente/revocada), sin más PII;
`@react-pdf/renderer` para el PDF descargable con la marca de la institución y el pie
"constancia de finalización; el título de bachiller lo expide…". `/aprender/certificados`
lista y enlaza. Revocar con motivo, auditado.

### 7. Panel del aliado (`/aliado`)

Métricas de `reportes.md` (`metrics.ts`) para su cohorte; tabla por estudiante (nombre,
avance con evidencia, evaluaciones, última actividad, en riesgo); exportar CSV; cartera
solo si `payerType PARTNER`. `progress.read.cohort` con alcance `partnerId`.

### 8. Ajustes (`/cohortes/[id]/matriculas/[enrollmentId]` → pestaña Ajustes)

Formulario de `Accommodation` con explicación por campo, advertencia sobre `notes`,
historial desde `AuditLog`. `/admin/inclusion/reporte` con la tabla del Decreto 1421.

## UX que importa aquí

Una acción principal por pantalla. Skeletons en vez de spinners. El video no autoplay.
Todo lo que tarda > 300 ms tiene estado visible. Sin red: el player sigue funcionando con
lo cargado y avisa; las respuestas nunca se pierden. Copy del glosario, nunca "en mora" ni
"bloqueado". Tamaño de texto y ancho respetan preferencias de lectura.

## Criterio de salida

- Las 7 evaluaciones migradas, respondidas como en LearnDash, dan el mismo puntaje.
- Intento vencido con respuestas guardadas → `SUBMITTED` y calificado; sin respuestas →
  `EXPIRED`; dos `start` en paralelo → un solo `IN_PROGRESS`.
- Autosave con la red cortada y reconexión no pierde ninguna respuesta (e2e con
  `context.setOffline`).
- Player y evaluación pasan axe y teclado a 320 px; VoiceOver en iOS recorre pregunta,
  opciones, cronómetro y entrega.
- Entrega devuelta y reenviada termina `APPROVED` y completa el tema.
- Completar un módulo emite su certificado en la siguiente corrida del job; el código se
  verifica públicamente; no hay dos `PROGRAM`.
- El aliado no ve otra cohorte (test "otra cohorte → 403").
