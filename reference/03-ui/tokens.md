# 03 — Tokens (contrato)

Todavía no hay código: este doc es el **contrato** que `packages/design-tokens` implementará
en la fase 1. Los nombres son definitivos; los valores se fijan al implementar y se
verifican con el test de contraste. `DESIGN.md` en la raíz es el mapa; esto es la lista.

## Principios

- Semántico, nunca literal: `surface.base`, no `white`; `status.overdue`, no `red-600`.
- Cada token tiene valor claro y oscuro. Un componente no sabe en qué modo está.
- Cada par texto/fondo declarado aquí tiene su ratio calculado y un test que lo verifica.
- Los estados del dominio son tokens de primera clase: el "con cuota vencida" y el
  "bloqueado" no se improvisan con un rojo.

## Superficies

| Token            | Uso                                              |
| ---------------- | ------------------------------------------------ |
| `surface.canvas` | Fondo de pantalla                                |
| `surface.base`   | Cards, paneles, el player                        |
| `surface.sunken` | Pozos: chips, barras de progreso, campos         |
| `surface.raised` | Diálogos, menús                                  |
| `surface.note`   | Fondo del aviso de legado y de los `role="note"` |

## Texto

`text.default` · `text.muted` (metadatos) · `text.subtle` (deshabilitado, ≥ 4.5:1 igualmente
sobre `surface.base`) · `text.onAccent` · `text.link` (subrayado siempre; el color no basta).

## Acento y estado

| Token            | Significado                                     | Siempre acompañado de                       |
| ---------------- | ----------------------------------------------- | ------------------------------------------- |
| `accent.base`    | Acción principal, activo, "siguiente"           | —                                           |
| `status.success` | Completado, aprobado, al día                    | icono check + texto                         |
| `status.warning` | Cuota próxima, tiempo < 5 min, legado pendiente | icono + texto                               |
| `status.error`   | Cuota vencida, reprobado, tiempo vencido        | icono + texto                               |
| `status.info`    | Financiado por aliado, en acuerdo de pago       | icono + texto                               |
| `status.locked`  | Tema bloqueado en progresión lineal             | icono candado + "Se habilita al completar…" |
| `status.legacy`  | Contenido pendiente de conversión               | `role="note"` con texto                     |

Cada `status.*` tiene `.base`, `.muted` (fondo suave) y `.onBase` (texto encima).

Añadidos en la fase 1 (15/9) porque el contrato no tenía estados interactivos ni bordes y el
primer átomo los necesitó (`// AMBIGUO`): `accent.hover` y `accent.active` (fondo del botón
primario en hover/active; `text.onAccent` sigue ≥ 4.5:1 sobre ambos), `surface.hover` (fondo de
filas y botones secundarios en hover), `border.default` (≥ 3:1 sobre `surface.base`, 1.4.11) y
`border.muted` (separadores no informativos, sin exigencia de contraste). Deshabilitado no usa
opacidad: `surface.sunken` + `text.subtle`.

## Tipografía (rol → uso)

`display` (título de área) · `heading` (título de tema, `h1`) · `subheading` (`h2`) · `body`
(lectura larga: el Markdown se renderiza en `body`, mínimo 16 px en móvil, line-height 1.5)
· `data` tabular (notas, cuotas, cronómetro: `font-variant-numeric: tabular-nums`) ·
`caption` (metadatos) · `overline` (etiquetas de sección, mayúsculas con tracking).
Fórmulas: MathML hereda `body`.

## Foco

`focus.ring` = color (≥ 3:1 contra cualquier superficie), grosor 3 px, offset 3 px. Un solo
`:focus-visible` global; ningún componente define el suyo. Nunca oculto por barras fijas.

## Espaciado, radios, tamaños

`space.{1,2,3,4,6,8,12}` en `rem` · `radius.{control,card,sheet,pill}` ·
`size.touchMin = 44px` (mínimo de toque, siempre) · `size.readingWidth = 68ch` (el Markdown
no se estira más) · `elevation.{0..3}`.

## Preferencias de lectura (variables que el usuario puede mover)

`reading.fontScale` (1 · 1.15 · 1.3) · `reading.lineHeight` (1.5 · 1.75 · 2) ·
`reading.width` (68ch · 56ch) · `reading.contrast` (normal · alto) · `reading.motion`
(sistema · reducido) · `reading.transcriptAlwaysVisible`. Se aplican como variables CSS en
el `html` desde `AccessibilityPreferencesProvider`; los tokens de texto y superficie las
respetan. Sin ellas se usa lo del sistema.

## Motion

`duration.{instant,fast,normal,slow}` · `easing.{standard,enter,exit}` · Doctrina en
`.claude/skills/motion-colombia-estudia`. `prefers-reduced-motion` = corte seco.

## Prohibido

Hex literales en componentes; `px` para texto; grises inventados; color como único
portador de estado; sombras a mano; emojis en UI.
