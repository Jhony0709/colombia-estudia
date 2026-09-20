# Manual corto — Autores (instructores)

**Tu pantalla de inicio**: `/contenido/temas`.

## Escribir un tema

«Nuevo tema» → asignatura, programa, módulo, título, objetivo. El editor es de bloques:
párrafos, encabezados (empieza por `##`), listas, tablas, imágenes, video, PDF.

- **Imágenes**: siempre con texto alternativo. Sin alt no se publica.
- **Video**: pega la dirección de Vimeo. Sube la transcripción (archivo `.vtt`); sin
  ella el tema avisa y el estudiante no tiene «solo transcripción».
- **PDF**: adjunta también la alternativa textual (Markdown); sin ella no se publica.
- **Inglés**: `:lang[texto]{en}` para que el lector de pantalla lo pronuncie bien.

«Vista previa» muestra exactamente lo que verá el estudiante. «Publicar» congela la
versión: lo que ya está asignado a una cohorte no cambia bajo los pies de nadie.

## «Se completa con entrega»

Márcalo solo si vas a revisar algo (un texto, un archivo). El tema no se completa leyendo:
se completa cuando apruebas la entrega en `/cohortes/[cohorte]/entregas`.

## Una evaluación

«Nueva evaluación» → preguntas (opción única, múltiple, verdadero/falso, respuesta corta)
con sus puntos. La clave de respuestas va en un panel aparte y nunca viaja al estudiante.
Reglas: intentos, minutos, porcentaje para aprobar, qué ve el estudiante después
(nada, la nota, o cada pregunta). Publicar.

## Si un estudiante reporta un problema

Te llega a `/notificaciones` con el motivo y el enlace al tema. Corrige y publica una
versión nueva; las cohortes abiertas siguen con la anterior hasta que operación la cambie.
