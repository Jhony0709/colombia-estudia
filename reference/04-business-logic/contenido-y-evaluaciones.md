# 04 — Contenido y evaluaciones

## Versionado: el catálogo cambia, lo publicado no

```
Program ─ Module ─ Lesson ──1:N──▶ LessonVersion ◀── LessonAssignment (cohorte, tema) ──▶ LessonProgress
                   Assessment ──1:N──▶ AssessmentVersion ◀── AssessmentAssignment (cohorte, evaluación) ──▶ Attempt
```

El autor edita `Lesson`. Al publicar se crea una `LessonVersion` **inmutable**. Una versión
publicada no se edita ni se borra: se publica otra.

**La asignación es (cohorte, tema), no (cohorte, versión).** `LessonAssignment.lessonVersionId`
puede cambiar —auditado— cuando el autor republica. El progreso guarda `lessonVersionId`:
con qué versión se recogió la evidencia. Regla al cambiar la versión de una asignación:

- por defecto el `COMPLETED` **sobrevive** (una corrección de tildes no reabre un tema);
- si la nueva versión tiene `invalidatesProgress = true` (el autor lo marca cuando el cambio
  es sustancial), los `LessonProgress` de esa asignación vuelven a `IN_PROGRESS` con la
  evidencia conservada, y se notifica al estudiante.

Para evaluaciones: `Attempt.assessmentVersionId` es el snapshot con el que se abrió el
intento; cambiar la versión de la asignación afecta solo a intentos nuevos.

**Una fuente, N cohortes.** Al abrir una cohorte se crean sus asignaciones con las versiones
vigentes del programa. El clon "ValoraT" de LearnDash desaparece: mismo catálogo, dos cohortes.

## Secuencia y aprobación

Dentro de un módulo, primero los temas (`Lesson.position`) y después las evaluaciones
(`Assessment.position`). Reglas de `progression`:

- `LINEAR` (Valida YA): el tema N se habilita al completar el N-1; la evaluación `SUBJECT`
  de un módulo se habilita al completar sus temas; **el módulo siguiente se habilita al
  aprobar (o agotar intentos de) las evaluaciones del anterior**. La `DIAGNOSTIC` es
  obligatoria antes del primer tema y nunca cuenta para aprobar; sus resultados los ve
  operaciones.
- `FREE`: todo abierto, con el orden como sugerencia.

`Enrollment` pasa a `COMPLETED` cuando todas las asignaciones de tema están `COMPLETED` y
toda evaluación `SUBJECT`/`FINAL` tiene un intento `GRADED` con `score/maxScore × 100 ≥
passPercent` (o cualquier `GRADED` si `passPercent` es nulo).

**SSOT**: `packages/domain/src/enrollment-completion.ts` y `lesson-completion.ts`.

## El contenido es Markdown

`LessonVersion.content` es **Markdown**: CommonMark + GFM (tablas, listas de tareas) +
LaTeX acotado + directivas propias. El contrato exacto es un parser/validador en
`packages/types/src/content.ts`, y es SSOT.

| Elemento                 | Sintaxis                                     | Regla                                                                                                                                                        |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Imagen                   | `![texto alternativo](asset:<id>)`           | `alt` obligatorio, descriptivo, distinto del nombre de archivo                                                                                               |
| Video                    | `::video{asset="<id>"}`                      | `captionsSource = REVIEWED` o `transcriptPath` (WebVTT sincronizado). `AUTO` no cuenta. Si el video muestra algo esencial, el texto de la lección lo explica |
| Audio                    | `::audio{asset="<id>"}`                      | Idem                                                                                                                                                         |
| PDF                      | `::pdf{asset="<id>"}`                        | `textAlternativePath` (Markdown con su texto)                                                                                                                |
| Fórmula                  | `$…$` en línea, `$$…$$` en bloque (LaTeX)    | Debe compilar; se renderiza a MathML con el LaTeX como respaldo                                                                                              |
| Fragmento en otro idioma | `:lang[The cat is on the table]{en}`         | Renderiza `<span lang="en">`                                                                                                                                 |
| Encabezados              | `##` en adelante (`#` es el título del tema) | Sin saltos de nivel                                                                                                                                          |
| Enlaces                  | `[texto](url)`                               | Texto descriptivo; nada de "clic aquí"                                                                                                                       |
| HTML crudo               | —                                            | Rechazado                                                                                                                                                    |

Todo `asset:<id>` debe ser de la **misma institución** y estar `READY`. Al publicar, los ids
se extraen a `LessonVersionAsset` (impide borrar un recurso en uso y hace consultable el legado).

Por qué Markdown y no JSON de un editor: texto plano, portable, diffable, destino natural
del OCR, render semántico limpio. Por qué LaTeX: Matemáticas, Geometría y Física; una
fórmula como imagen no la lee nadie con lector de pantalla.

**Pegar imágenes funciona como en GitHub**, y además por teclado: botón "Subir imagen"
(`<input type="file">`), diálogo "Describe la imagen" con el `alt` obligatorio, y se inserta
`![alt](asset:<id>)`. El editor no deja guardar un `alt` vacío ni igual al nombre del archivo.

## Dos caminos para el contenido existente

El contenido de LearnDash son en su mayoría **imágenes de páginas de PDF** y **videos de
Vimeo**. Se soportan ambos caminos, y la meta es que todo acabe en el primero.

**Camino 1 — Transcripción a Markdown (el destino).** Pipeline de migración: imagen o PDF
→ OCR → borrador Markdown estandarizado (títulos, listas, tablas, fórmulas en LaTeX) →
`LessonVersion` en `DRAFT` para revisión humana. Figuras que no son texto se recortan e
insertan como imagen con `alt`. Publica con la validación normal.

**Camino 2 — PDF o imagen como legado (el puente).** Se importa con `MediaAsset.legacy = true`
y se publica con `LessonVersion.legacyException { reason, approvedById, approvedAt }` y
`convertUntil`, registrado en `AuditLog`. La validación **no bloquea** una versión con
excepción, pero:

- el player muestra un aviso (`role="note"`): "Este tema es una imagen escaneada; estamos
  convirtiéndolo. Fecha prevista: {convertUntil}", con zoom/pan por teclado y pinch, descarga
  del original, y el botón **"Pedir versión accesible"** (`POST …/request-accessible`), cuyo
  contador prioriza la conversión;
- el `alt` sigue el patrón "Página {n} de {tema}, texto en imagen pendiente de transcripción";
- `/contenido/legado` lista el legado con `convertUntil` y solicitudes;
- **contenido nuevo nunca puede ser legado**: `POST …/publish` rechaza cualquier
  `legacyException`; solo el servicio del importador escribe ese campo.

**Decisión 5 (Jhonny): texto automático.** El borrador OCR sin revisar se guarda en
`MediaAsset.textAlternativePath` y el player lo expone como alternativa textual bajo el
aviso "Texto generado automáticamente; puede contener errores". Sirve al lector de
pantalla y a la búsqueda desde el día uno; la revisión humana sigue siendo el destino.

**Decisión 6: los videos migrados publican bajo la excepción de legado** con
`captionsSource AUTO` o `NONE`; nadie revisa subtítulos por ahora. La regla estricta aplica
a videos nuevos.

## La publicación valida, y rechaza

La transición `publish` es el único punto por el que pasa todo el contenido:

| Regla (Markdown)                                                                 | Qué rechaza                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Toda imagen tiene `alt` descriptivo (en una lección no hay imágenes decorativas) | `![](…)`, `![IMG_2024.png](…)`                                   |
| Un gráfico o diagrama con datos lleva además una tabla o texto con los datos     | **Aviso** si el `alt` supera 250 caracteres sin tabla cerca      |
| Todo video y audio tiene subtítulos revisados o transcripción                    | `::video` con `captionsSource` `NONE`/`AUTO` y sin transcripción |
| Todo PDF tiene alternativa textual                                               | `::pdf` sin `textAlternativePath`                                |
| Todo asset es de la institución y está `READY`                                   | Id ajeno, subida a medias                                        |
| Todo LaTeX compila                                                               | `$\frac{1}{$`                                                    |
| Los encabezados no saltan niveles                                                | `####` después de `##`                                           |
| Los enlaces tienen texto descriptivo                                             | "clic aquí", "ver más"                                           |
| Las tablas tienen fila de encabezado                                             | Tabla GFM sin cabecera                                           |
| El Markdown cumple el contrato                                                   | Directiva desconocida, HTML crudo                                |
| Lección de Inglés sin ningún `:lang{en}`                                         | **Aviso**, no rechazo                                            |

| Regla (evaluación)                                                                                   | Qué rechaza             |
| ---------------------------------------------------------------------------------------------------- | ----------------------- |
| Enunciado no vacío; imágenes con `alt`; LaTeX que compila                                            |                         |
| `single_choice` / `true_false`: ≥ 2 opciones no vacías, exactamente una correcta                     |                         |
| `multiple_choice`: ≥ 2 opciones, ≥ 1 correcta                                                        |                         |
| `short_text`: lista de respuestas aceptadas y normalización explícita (tildes, mayúsculas, espacios) | "Bogota" calificada mal |
| `content` no contiene ninguna clave del `answerKey`                                                  | Fuga de respuestas      |

El error que ve el autor dice qué falta, dónde y cómo se arregla, en una lista navegable
con enlace a la línea, no en un toast.

**SSOT**: `packages/domain/src/publish-validation.ts`. La misma función corre en el editor
(aviso en vivo) y en el endpoint (rechazo).

## Progreso con evidencia, no con un clic

`LessonProgress.evidence` guarda lo que pasó; `COMPLETED` lo decide
`packages/domain/src/lesson-completion.ts` según la forma del contenido:

| Forma                            | Evidencia de completado                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Video                            | posición ≥ 90 % **o** transcripción leída hasta el final (`transcriptReadToEnd`) |
| Markdown                         | scroll al final **y** tiempo ≥ min(`estimatedMinutes` × 0,5, 2 min)              |
| Legado (imagen/PDF)              | visto hasta el final **y** tiempo mínimo                                         |
| Actividad (`requiresSubmission`) | `Submission` con estado `APPROVED` por un instructor. Nada más lo completa       |

`source`: `EVIDENCE` (normal), `MANUAL` (operaciones con `progress.override`, motivo y
`AuditLog`), `IMPORTED` (reservado; con la decisión 1 no se importa progreso).

## Entregas de actividad

Un tema con `requiresSubmission` (los "ACTIVIDAD" de LearnDash) se completa con una
`Submission`: texto y/o un archivo (imagen, PDF, audio) subido a Storage. El instructor
la ve en `/cohortes/[id]/entregas`, y la **aprueba** (completa el tema, `EVIDENCE`) o la
**devuelve** con comentarios (`RETURNED`; el estudiante reenvía). Notificación en ambos
sentidos. Cubre lo que `open_text` habría cubierto, con archivo además.

## Certificados

Al completar un módulo (todos sus temas `COMPLETED` y sus evaluaciones aprobadas) el job
diario emite un `Certificate MODULE`; al pasar la matrícula a `COMPLETED`, uno `PROGRAM`.
Código público, verificable en `/certificado/[code]`, revocable con motivo. Es una
**constancia de finalización**: el título de bachiller lo expide quien tiene la
autorización legal, fuera de la plataforma, y la constancia lo dice. **Nunca se condiciona
a la cartera** (§2 de `acceso-y-cartera.md`). Un estudiante
bloqueado por un tema que no puede completar (video caído, sin subtítulos con
`requiresCaptions`) tiene "Reportar un problema con este tema", que notifica a operaciones.

## Evaluaciones

`AssessmentVersion.content` es JSON validado con Zod (preguntas, sin respuestas);
`answerKey` es JSON aparte, excluido del cliente Prisma por defecto (`omit`) y leído solo
por `grading.ts`. Test: ningún endpoint bajo `/api/learn` devuelve `answerKey`.

Tipos de pregunta del MVP: `single_choice`, `multiple_choice`, `true_false`, `short_text`.
`open_text` (calificación manual) queda post-MVP: la muestra de LearnDash es 100 %
respuesta única.

Reglas del intento, congeladas en la versión: `maxAttempts`, `timeLimitMinutes`,
`passPercent`, `reviewPolicy`.

```
deadlineAt = min( startedAt + timeLimitMinutes × extraTimeFactor (o ∞ si exemptFromTimer),
                  assignment.dueAt,
                  enrollment.accessUntil )
intentos disponibles = maxAttempts + allowedAttemptsBonus
```

**SSOT**: `packages/domain/src/attempt-policy.ts`.

```
IN_PROGRESS  iniciado, dentro del plazo. Un solo IN_PROGRESS por (matrícula, asignación)
SUBMITTED    entregado por el estudiante, o cerrado por el job al vencer CON respuestas guardadas
EXPIRED      venció sin ninguna respuesta guardada
GRADED       calificado (automático)
```

Al vencer `deadlineAt` con respuestas autoguardadas, el servidor **entrega y califica**; nadie
pierde 40 minutos por un `PATCH` fallido en el último segundo. Autosave por respuesta con
cola local y reintento; la UI muestra `deadlineAt` del servidor, no un contador local; la
entrega pide confirmación y lista las preguntas sin responder (WCAG 3.3.4).

`reviewPolicy` gobierna qué devuelve el serializador tras `GRADED`: `NONE` (solo estado),
`SCORE_ONLY`, `FULL_AFTER_GRADED` (respuestas y correctas), `FULL_AFTER_DUE` (lo mismo,
pero solo pasado `dueAt`, para que nadie comparta las respuestas antes).

`Score` (0–100) se deriva del mejor intento `GRADED` de la evaluación `SUBJECT` de la
asignatura en la cohorte; `sourceAttemptId` lo enlaza. Se persiste para consulta y reporte.
