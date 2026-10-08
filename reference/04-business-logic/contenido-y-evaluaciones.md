# 04 — Contenido y evaluaciones

## Versionado: el catálogo cambia, lo publicado no

```
Program ─ Module ─ Lesson ──1:N──▶ LessonVersion ◀── LessonAssignment (cohorte, tema) ──▶ LessonProgress
                   Assessment ──1:N──▶ AssessmentVersion ◀── AssessmentAssignment (cohorte, evaluación) ──▶ Attempt
```

El autor edita `Lesson`. Al publicar se crea una `LessonVersion` **inmutable**. Una versión
publicada no se edita ni se borra: se publica otra.

**La asignación es (cohorte, tema), no (cohorte, versión), y sigue a la versión publicada
(27/9).** Al publicar, `LessonAssignment.lessonVersionId` pasa a la versión nueva en todas las
cohortes `PLANNED`/`OPEN` cuya asignación no esté **fijada** (`pinnedVersion`), en la misma
transacción y auditado por asignación (`version_changed` con `onPublish`). Para el autor,
publicar es «guardar cambios»; la congelación es de la cohorte, no del contenido: fijar una
asignación (pestaña «Ruta» de la cohorte) es la excepción, para la que está a punto de cerrar
y no quiere que le muevan el piso; soltarla la pone al día en el acto. Las `CLOSED`/`ARCHIVED`
no se tocan: terminaron con la versión con la que terminaron. El progreso guarda
`lessonVersionId`: con qué versión se recogió la evidencia. Regla al cambiar la versión de una
asignación, sea al publicar o a mano:

- por defecto el `COMPLETED` **sobrevive** (una corrección de tildes no reabre un tema);
- si la nueva versión tiene `invalidatesProgress = true` (el autor lo marca cuando el cambio
  es sustancial), los `LessonProgress` de esa asignación vuelven a `IN_PROGRESS` con la
  evidencia conservada, y se notifica al estudiante.

Para evaluaciones: `Attempt.assessmentVersionId` es el snapshot con el que se abrió el
intento; cambiar la versión de la asignación —al publicar o a mano— afecta solo a intentos
nuevos.

**Una fuente, N cohortes.** Al abrir una cohorte se crean sus asignaciones con las versiones
vigentes del programa. El clon "ValoraT" de LearnDash desaparece: mismo catálogo, dos cohortes.

## Secuencia y aprobación

Dentro de un componente (`Module`) la ruta se recorre **taller a taller** (3/10, cliente:
«taller = asignatura», `Subject`): los temas de una asignatura en su `Lesson.position`, cada
uno seguido de sus exámenes de tema (`Assessment.lessonId`), y después el cuestionario del
taller (`Assessment.subjectId` sin `lessonId`); luego el siguiente taller, en el orden en que
aparece su primer tema. Al final, los exámenes del componente sin taller. Al enviar el
cuestionario se lee `Assessment.closingText` («Aprender es avanzar» del taller), o en su
defecto `Module.closingText`, o el texto general. `sortItems` (`outline.ts`) es la única
función que ordena, tanto para el estudiante como para el builder del admin.

Reglas de `progression`:

- `LINEAR`: el ítem N se habilita al completar el N-1, cruzando talleres. Un cuestionario cuenta
  como completado cuando **aprueba** o cuando **agota sus intentos** con todos cerrados (8/10,
  Jhonny; `assessmentStatus` en `features/learn/server/outline.ts`): perder con intentos por
  delante no deja seguir; perderlos todos **no bloquea** la ruta (cliente, 3/10). La `DIAGNOSTIC` es obligatoria antes del primer tema y nunca
  cuenta para aprobar; sus resultados los ve operaciones.
- `FREE`: todo abierto, con el orden como sugerencia.

**El componente es la unidad de bloqueo (3/10, cliente).** En `LINEAR`, el primer componente
de la ruta de la matrícula (su `startsAtModule`) está abierto; cada uno de los siguientes está
**bloqueado hasta que operación lo habilita a mano** desde la ficha de la matrícula
(`EnrollmentModule`: quién, cuándo, y una ventana `availableFrom`/`availableUntil` opcional
por componente, no por tema). Al terminar un componente el estudiante ve «Terminaste lo que
tienes habilitado» y el siguiente con su portada en gris; cuando se habilita recibe el aviso
`module_unlocked`. La regla vive en `moduleAccess` (`outline.ts`); el motivo del componente
manda sobre la secuencia (`unavailableReason: 'LOCKED'`). Es acceso académico y **no mira
cartera**: que operación habilite «cuando hay pago» es su práctica, no una regla del código;
la mora sigue gobernada por `RestrictionPolicy` y nunca toca el acceso de un menor. En `FREE`
no se consulta. Regla general aprobada por el cliente el 3/10 con la condición de que hoy no
hay menores matriculados.

`Enrollment` pasa a `COMPLETED` cuando todas las asignaciones de tema están `COMPLETED` y
toda evaluación `SUBJECT`/`FINAL` tiene un intento `GRADED` con `score/maxScore × 100 ≥
passPercent` (o cualquier `GRADED` si `passPercent` es nulo).

**SSOT**: `packages/domain/src/enrollment-completion.ts` y `lesson-completion.ts`.

## El contenido es Markdown

`LessonVersion.content` es **Markdown**: CommonMark + GFM (tablas, listas de tareas) +
LaTeX acotado + directivas propias. El contrato exacto es un parser/validador en
`packages/types/src/content.ts`, y es SSOT.

| Elemento                 | Sintaxis                                       | Regla                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imagen                   | `![texto alternativo](asset:<id>)`             | `alt` obligatorio, descriptivo, distinto del nombre de archivo; con título (`![alt](asset:<id> "Pie")`) y sola en su línea sale como figura con pie (4/10)                                                                                                                                                                          |
| Video                    | `::video{asset="<id>"}`                        | `captionsSource = REVIEWED` o `transcriptPath` (WebVTT sincronizado). `AUTO` no cuenta. Si el video muestra algo esencial, el texto de la lección lo explica                                                                                                                                                                        |
| Audio                    | `::audio{asset="<id>"}`                        | Idem                                                                                                                                                                                                                                                                                                                                |
| PDF                      | `::pdf{asset="<id>"}`                          | `textAlternativePath` (Markdown con su texto)                                                                                                                                                                                                                                                                                       |
| Fórmula                  | `$…$` en línea, `$$…$$` en bloque (LaTeX)      | Debe compilar; se renderiza a MathML con el LaTeX como respaldo                                                                                                                                                                                                                                                                     |
| Fragmento en otro idioma | `:lang[The cat is on the table]{en}`           | Renderiza `<span lang="en">`                                                                                                                                                                                                                                                                                                        |
| Recuadro (27/9)          | `:::callout{kind="example" title="…"}` … `:::` | `kind` ∈ `note`, `example`, `important`, `goals` (otro = error); `goals` = «En este tema aprenderás», en el flujo (el flotado a la derecha se retiró el 4/10); `title` opcional (por defecto Nota / Ejemplo / Importante); cuerpo en Markdown. Renderiza `<aside class="callout callout-<kind>">` con el título como primer párrafo |
| Encabezados              | `##` en adelante (`#` es el título del tema)   | Sin saltos de nivel; si el primer bloque repite el título del tema (con o sin «Taller 1.»), el render lo quita (4/10); los `##` forman el índice «En este tema»                                                                                                                                                                     |
| Enlaces                  | `[texto](url)`                                 | Texto descriptivo; nada de "clic aquí"                                                                                                                                                                                                                                                                                              |
| HTML crudo               | —                                              | Rechazado                                                                                                                                                                                                                                                                                                                           |

Todo `asset:<id>` debe ser de la **misma institución** y estar `READY`. Al guardar el borrador
y al publicar, los ids se extraen a `LessonVersionAsset` (impide borrar un recurso en uso y hace
consultable qué versión usa qué recurso). En el borrador solo se vinculan ids que existen; la
exigencia de `READY` es de la publicación.

**Recursos que nadie usa (27/9).** El editor sube la imagen al pegarla, antes de saber si se
quedará. Lo que ninguna versión (`usedBy`), entrega (`submissions`) ni portada (`coverOf`)
referencia pasados 7 días (`UNUSED_MEDIA_GRACE_DAYS`) lo borra el job diario
(`sweepUnusedMedia`, `media.service.ts`): primero el objeto de Storage, después la fila, con el
mismo `where` para que un reclamo tardío la salve por `Restrict`. Cubre el `PENDING` que nunca
confirmó, la imagen pegada y no guardada y la que se quitó del texto. `AuditLog media.swept` con
los conteos. El cliente no borra nunca.

Por qué Markdown y no JSON de un editor: texto plano, portable, diffable, destino natural
del OCR, render semántico limpio. Por qué LaTeX: Matemáticas, Geometría y Física; una
fórmula como imagen no la lee nadie con lector de pantalla.

**Pegar imágenes funciona como en GitHub** (hecho el 27/9), y además por teclado: botón
"Subir imagen" (`<input type="file">`), pegar o soltar en cualquier bloque, diálogo "Describe
la imagen" con el `alt` obligatorio, y se inserta `![alt](asset:<id>)`. La imagen se reescala
en el navegador (lado mayor ≤ 2000 px, WebP) antes de subir. El diálogo no acepta un `alt`
vacío ni igual al nombre del archivo; la validación de publicación lo vuelve a comprobar.

## Dos caminos para el contenido existente

El contenido de LearnDash son en su mayoría **imágenes de páginas de PDF** y **videos de
Vimeo**. Se soportan ambos caminos, y la meta es que todo acabe en el primero.

**Camino 1 — Transcripción a Markdown (el destino).** Pipeline de migración: imagen o PDF
→ OCR → borrador Markdown estandarizado (títulos, listas, tablas, fórmulas en LaTeX) →
`LessonVersion` en `DRAFT` para revisión humana. Figuras que no son texto se recortan e
insertan como imagen con `alt`. Publica con la validación normal.

> **Retirado el 18/9.** Al cancelarse la importación desde LearnDash no hay contenido
> migrado, así que no hay nada que excepcionar: `legacyException`, `convertUntil` y
> `MediaAsset.legacy` salieron del schema y del código. Lo de abajo se conserva como
> registro de por qué existió, no como descripción del sistema. Ver `PRODUCT_DECISIONS.md`.

**Camino 2 — ~~PDF o imagen como legado~~ (RETIRADO).** Se importa con `MediaAsset.legacy = true`
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

> Ninguna de esas cuatro viñetas existe hoy: la ruta `/contenido/legado`, el endpoint
> `GET /api/content/legacy`, el aviso del player y el rechazo en `publish` se retiraron
> con el campo. Publicar valida igual para todos: sin alternativa textual no se publica.

**Decisión 5 (Jhonny): texto automático.** El borrador OCR sin revisar se guarda en
`MediaAsset.textAlternativePath` y el player lo expone como alternativa textual bajo el
aviso "Texto generado automáticamente; puede contener errores". Sirve al lector de
pantalla y a la búsqueda desde el día uno; la revisión humana sigue siendo el destino.

**~~Decisión 6: los videos migrados publican bajo la excepción de legado~~ — SIN EFECTO
desde el 18/9** (no hay videos migrados). Todo video nuevo cumple la regla estricta: con
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

| Forma                                   | Evidencia de completado                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Video                                   | posición ≥ 90 % **o** transcripción leída hasta el final (`transcriptReadToEnd`)                                                               |
| Markdown                                | scroll al final **y** tiempo ≥ min(`estimatedMinutes` × 0,5, 2 min); con 0 o sin minutos, solo el scroll (5/10; antes, sin minutos eran 2 min) |
| ~~Legado (imagen/PDF)~~ (RETIRADO 18/9) | — `LessonForm` ya solo tiene `VIDEO`, `MARKDOWN` y `SUBMISSION`                                                                                |
| Actividad (`requiresSubmission`)        | `Submission` con estado `APPROVED` por un instructor. Nada más lo completa                                                                     |

`source`: `EVIDENCE` (normal), `MANUAL` (operaciones con `progress.override`, motivo y
`AuditLog`), `IMPORTED` (reservado; con la decisión 1 no se importa progreso).

## Entregas de actividad

Un tema con `requiresSubmission` (los "ACTIVIDAD" de LearnDash) se completa con una
`Submission`: texto y/o un archivo (imagen, PDF, audio) subido a Storage. El instructor
la ve en `/cohortes/[id]/actividades`, y la **aprueba** (completa el tema, `EVIDENCE`) o la
**devuelve** con comentarios (`RETURNED`; el estudiante reenvía). Notificación en ambos
sentidos. Cubre lo que `open_text` habría cubierto, con archivo además.

**La actividad es una sección propia del tema (23/9).** `Lesson.activityInstructions`
(Markdown, se pinta con el mismo `renderLessonHtml` que el texto) y
`Lesson.activityAccepts` (`TEXT` | `FILE` | `TEXT_OR_FILE`) viven en el tema, **no en la
versión** (decisión de Jhonny, 23/9): se corrigen en caliente y las cohortes abiertas los
ven al momento, al revés que el texto, que está congelado por asignación. La forma de
completar (`requiresSubmission`) sí sigue cerrada con el tema publicado. El servidor
rechaza una entrega que no cumpla `activityAccepts` (texto donde se pidió archivo, etc.).
Una entrega `SUBMITTED` se puede **reemplazar hasta que alguien la revise**: la revisión
empieza cuando el instructor decide, no cuando el estudiante pulsa enviar. Una `APPROVED`
no se toca.

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
pero solo pasado `dueAt`, para que nadie comparta las respuestas antes) y
`FULL_AFTER_LAST_ATTEMPT` (3/10, cliente: la nota siempre; las correctas solo cuando ya no
puede volver a presentar —agotó `maxAttempts` + bono de ajuste, o aprobó—;
`attemptsExhausted` en `attempt.service.ts`). La pantalla previa dice «es el último» cuando
queda un intento.

`Score` (0–100) se deriva del mejor intento `GRADED` de la evaluación `SUBJECT` de la
asignatura en la cohorte; `sourceAttemptId` lo enlaza. Se persiste para consulta y reporte.
