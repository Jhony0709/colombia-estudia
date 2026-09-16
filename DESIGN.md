# DESIGN.md — Colombia Estudia, mapa del sistema para agentes

Documento portable del sistema de diseño (patrón Impeccable, heredado de don-pepo). **Es
un mapa, no la fuente**: los nombres viven en `reference/03-ui/tokens.md` (contrato) y,
desde la fase 1, los valores en `packages/design-tokens/src/contract/SemanticTokens.ts`.
En conflicto, el contrato gana. Skills hermanas: `.claude/skills/ui-craft-colombia-estudia`
y `.claude/skills/motion-colombia-estudia`.

## A quién le diseñamos

Adultos que terminan el bachillerato de noche, desde un celular de gama media con datos
limitados, a veces con un lector de pantalla; operaciones que matricula y cobra desde un
portátil; un aliado que quiere un Excel. La UI es en español de Colombia y no tiene prisa
por parecer moderna: tiene prisa por no confundir.

## Superficies

`surface.canvas` (fondo) → `surface.sunken` (pozos: chips, barras de progreso, campos) →
`surface.base` (cards, el player) → `surface.raised` (diálogos, menús). `surface.note` es
el único fondo con carácter: aviso de legado y `role="note"`. Nada de cards dentro de
cards: el interior usa `sunken`.

## Tipografía (rol → uso)

`display` título de área · `heading` título del tema (`h1`) · `subheading` (`h2`) · `body`
lectura larga: **el Markdown se renderiza en `body`, ≥ 16 px en móvil, line-height 1.5,
ancho máximo `size.readingWidth = 68ch`** · `data` tabular para notas, cuotas y cronómetro
(`tabular-nums`) · `caption` metadatos · `overline` etiquetas de sección. Fórmulas: MathML
hereda `body`. Nunca `px` para texto; nunca un tamaño que no sea un rol.

## Color semántico

`accent.base` = acción principal, "siguiente", activo. `status.success` completado /
aprobado / al día · `status.warning` cuota próxima, tiempo < 5 min, legado pendiente ·
`status.error` cuota vencida, reprobado, tiempo vencido · `status.info` financiado por
aliado, en acuerdo · `status.locked` tema bloqueado · `status.legacy` pendiente de
conversión. **Todo estado lleva icono y texto además del color** (WCAG 1.4.1). `text.link`
siempre subrayado. Prohibido: hex literales, grises inventados, "beige AI", color como
único portador de estado.

## Foco y preferencias

Un solo `focus.ring` (3 px, offset 3 px) para todo; ningún componente define el suyo.
Las preferencias de lectura (tamaño, interlineado, ancho, contraste, movimiento,
transcripción visible) son variables CSS que los tokens respetan; se cambian en un solo
sitio y toda la UI las sigue.

## Espaciado, radios, tamaños

`space.{1..12}` en `rem` · `radius.{control,card,sheet,pill}` · `size.touchMin = 44px`
SIEMPRE en player, evaluación y cartera · `elevation.{0..3}` vía helper, nunca sombra a
mano. Reflow a 320 px sin scroll horizontal; tablas en contenedor con scroll propio.

## Motion (resumen — la doctrina completa en motion-colombia-estudia)

`duration.{instant,fast,normal,slow}` con usos fijos · `easing.{standard,enter,exit}` ·
entrada = fade/grow, salida = fade o corte · `prefers-reduced-motion` = corte seco en
ambos sentidos · nada parpadea > 3/s · el cronómetro no anima: cambia el número.

## Patrones de composición

- **Ruta del programa**: módulos como secciones con `overline`; temas como filas
  presionables (un solo botón para el lector de pantalla), con estado icono+texto a la
  derecha; el bloqueado dice qué lo desbloquea.
- **Player**: `h1` del tema → aviso de legado si aplica (`role="note"`) → video con "Saltar
  el video" antes y transcripción `<details open>` debajo → Markdown en `body` a 68ch →
  barra de acciones fija abajo con `touchMin` ("Anterior", "Marcar", "Siguiente").
- **Intento**: pantalla previa (intentos, tiempo ya con ajuste, "no podrás pausar") →
  una pregunta por pantalla en móvil → `role="timer"` visible y ocultable → entrega con
  resumen de sin responder.
- **Cartera**: tabla por cohorte con estado derivado (icono + texto), acciones por fila,
  cada acción financiera en dos pasos con resumen.
- **Estados vacíos y terminales**: siempre con causa, fecha y contacto de la institución.
  Nunca una pantalla en blanco.

## Voz (copy)

Clara, cercana, sin condescendencia y sin jerga administrativa hacia el estudiante: "Con
cuota vencida", nunca "en mora"; "Se habilita al completar Física – Magnitudes", no
"bloqueado". Segunda persona. Sin emojis en UI ni notificaciones. Etiquetas de estados en
`reference/09-glossary.md`.

## Reglas de proceso

Todo en tokens (el barrido `/audit-ui` de ui-craft-colombia-estudia es obligatorio antes
de cerrar trabajo visual). Todo componente interactivo se prueba con teclado antes del PR.
Story con addon-a11y por componente. Componentes retirados no se borran. Pruebas en
dispositivo y con lector de pantalla: Jhonny.
