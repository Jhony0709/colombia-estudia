# 07 — Contenido y migración (fase 3, semanas 6-9)

## Objetivo

Todo el programa actual de Valida YA dentro de la plataforma, revisado, con los videos de
Vimeo intactos, el texto automático del OCR como alternativa y la lista de legado
visible; y un editor en el que un autor publica un tema nuevo que nace accesible.

## Pasos

### 1. Parser y validador del contrato (`packages/types/src/content.ts`)

Pipeline `unified`: `remark-parse` → `remark-gfm` → `remark-math` → `remark-directive` →
plugin propio que valida directivas (`video`, `audio`, `pdf` con `asset`; `lang` inline)
y recoge `asset:<id>` → `remark-rehype` (sin `allowDangerousHtml`) → `rehype-katex`
(salida MathML) → `rehype-sanitize` con esquema propio → `rehype-stringify`. Exporta
`parseContent(md): { ast, assets, headings, warnings }` y `renderContent(md, assets)`.
Tests con fixtures: cada regla de `contenido-y-evaluaciones.md` tiene un `.md` que la
viola y uno que la cumple.

### 2. Validación de publicación (`packages/domain/src/publish-validation.ts`)

Recibe el AST y los `MediaAsset` resueltos (por id, con `institutionId`, `status`,
`altText`, `captionsSource`, `transcriptPath`, `textAlternativePath`); devuelve
`{ errors: [{ rule, line, message, fix }], warnings }`. Es la misma función en el editor
(aviso en vivo, con debounce) y en `POST …/publish`.

### 3. Editor (`features/content/editor`)

~~CodeMirror 6 con `@codemirror/lang-markdown`, tema con tokens, `Escape` suelta `Tab`
(documentado en pantalla), autocompletado de directivas.~~ **Descartado el 17/9**; el
`<textarea>` que lo sustituyó, **sustituido el 19/9** por un editor propio de bloques sin
`contenteditable` (`features/content/editor`, ver `PRODUCT_DECISIONS.md`). Se guarda Markdown,
recortado del original bloque a bloque. Pegar una dirección de Vimeo en un texto vacío lo
convierte en vídeo. El aviso lleva al bloque. Barra: "Subir imagen" (input
file), "Insertar video de Vimeo" (pega URL o id → `POST /api/media/vimeo`), "Fórmula"
(diálogo con vista previa MathML), "Fragmento en otro idioma". Pegar/arrastrar imagen →
`POST /api/media/upload` → subida directa → `confirm` → diálogo "Describe la imagen" (alt
obligatorio) → inserta `![alt](asset:id)`. Panel lateral: avisos de validación como lista
navegable con enlace a línea; vista previa con el render real (encabezados, MathML).
Autosave del DRAFT cada 5 s con indicador `role="status"`.

Publicar: diálogo de confirmación con el resumen de validación; si hay errores, no hay
botón. Checkbox "Este cambio reabre el tema para quien ya lo completó"
(`invalidatesProgress`), desmarcado por defecto.

### 4. Evaluaciones (`features/content/assessments`)

Editor de preguntas por tipo, con `answerKey` en un panel aparte (visualmente separado y
nunca en el mismo objeto); reglas del intento y `reviewPolicy` por versión; validación
de `contenido-y-evaluaciones.md`. Publicar separa `content` y `answerKey` y verifica que
ninguna clave del segundo aparezca en el primero.

### 5. Media (`lib/media`)

`storage.ts`: rutas por institución, URLs firmadas de subida (PUT) y de lectura (GET, 10
min), `confirm` con magic bytes. `vimeo.ts`: `GET /videos/{id}` y `/videos/{id}/texttracks`
con el token; `captionsSource` = `AUTO` si `type === 'captions'` generado, `REVIEWED` solo
por acción del autor; descarga del VTT a `transcriptPath` cuando existe.

### 6. Biblioteca

`/aprender/biblioteca` lista los `MediaAsset` de tipo `DOCUMENT` y `AUDIO` referenciados por
las versiones asignadas a la cohorte, agrupados por módulo, con tamaño y "descargar" (URL
firmada, `attachment`).

### 7. ~~Importador de LearnDash~~ — **CANCELADO el 18/9** (ver `PRODUCT_DECISIONS.md`): todo el contenido es nuevo

<!-- El detalle de abajo se conserva por si algún día entra contenido de otra plataforma. -->

#### (cancelado) Importador de LearnDash (`packages/scripts/migrate/learndash/`)

Entrada: dump SQL de WordPress (tablas `wp_posts`, `wp_postmeta`, `wp_wp_pro_quiz_master`,
`wp_wp_pro_quiz_question`, `wp_term_*`) restaurado en un Postgres local o parseado con
`mysql2` contra un MySQL en Docker. Pasos, cada uno idempotente por `sourceRef`:

1. **Programa y módulos** desde `sfwd-courses` (14035) y sus secciones (`course_sections`
   en postmeta): `Program "Bachillerato Valida YA"`, `Module` por "MÓDULO MES n".
2. **Asignaturas y temas**: cada `sfwd-lessons` → `Subject`; cada `sfwd-topic` →
   `Lesson` (posición por `menu_order`; `requiresSubmission` si el título contiene
   "ACTIVIDAD"); su `post_content` → detección: iframe de Vimeo → `MediaAsset VIMEO` +
   `::video`; imágenes → descarga desde `wp-content/uploads`, subida a Storage,
   `MediaAsset IMAGE legacy` + OCR; texto real → Markdown vía `turndown`.
3. **Versión inicial**: `LessonVersion 1 PUBLISHED` con `legacyException { reason:
'learndash-import' }` y `convertUntil` = fecha de lanzamiento + 6 meses (decisión del
   importador, configurable).
4. **Evaluaciones**: `sfwd-quiz` → `Assessment` (`DIAGNOSTIC` para "Diagnóstico inicial",
   `SUBJECT` por lección); preguntas de ProQuiz (`answer_data` serializado PHP →
   `php-unserialize`) → `content` + `answerKey`; `single_choice` para "Respuesta única".
5. **Deduplicación del clon ValoraT**: hash del título normalizado + hash del JSON de
   preguntas; el clon no crea entidades nuevas, se registra en `ImportRun.summary`.
6. **Vimeo**: por cada id, consulta de metadatos; `captionsSource` según pistas.
7. `dryRun` produce el resumen con conteos esperados (110 temas, 7 evaluaciones, 239
   preguntas) y las diferencias; ejecutar solo cuando el resumen coincide.

No se importan personas, cohortes con inscritos ni progreso (decisión 1). Las cohortes
históricas quedan en LearnDash en solo lectura.

### 8. ~~OCR~~ — **CANCELADO el 18/9**: no hay imágenes de página que transcribir

#### (cancelado) OCR (`packages/scripts/migrate/ocr/`)

Tesseract (`tesseract.js` o binario) con `spa`, preprocesado con `sharp` (binarización,
deskew), salida a Markdown con heurísticas: líneas en mayúsculas cortas → `##`, viñetas →
listas, fórmulas detectadas por patrón → `$…$` para revisión. Resultado a
`textAlternativePath` del `MediaAsset` (decisión 5: se expone con aviso) y, para los 10 de
prueba, a un `LessonVersion 2 DRAFT` para revisión humana. Métrica: % de caracteres
corregidos a mano en los 10; decide cuántos se transcriben antes del lanzamiento.

### 9. ~~`/contenido/legado`~~ — **CANCELADO el 18/9**: no va a haber ninguna versión con excepción de legado

Tabla de versiones con `legacyException`, `convertUntil`, solicitudes de versión accesible,
videos con `captionsSource ≠ REVIEWED`; filtros; exportar.

## Criterio de salida

- `dryRun` reproduce los conteos; el clon no duplica; `ImportRun.summary` guardado.
- Cada regla de la tabla de validación tiene fixture que la rechaza con línea y mensaje.
- Un SVG renombrado a `.png` es rechazado en `confirm`.
- Publicar un tema nuevo con video sin subtítulos revisados falla; con transcripción, pasa.
- 10 temas OCR revisados publican sin excepción; el % de corrección está registrado.
- Editor usable por teclado; `Escape` suelta `Tab`; diálogo de alt accesible.
