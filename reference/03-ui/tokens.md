# 03 — Tokens (contrato)

Este doc es el **contrato** que implementa `packages/design-tokens`. Los nombres son
definitivos; los valores se verifican con el test de contraste. `DESIGN.md` en la raíz es el mapa; esto es la lista.

## Principios

- Semántico, nunca literal: `surface.base`, no `white`; `status.overdue`, no `red-600`.
- **Los neutros se derivan del tono del acento (214°) a saturación muy baja.** No son grises
  genéricos: un gris inventado delata una pantalla generada; uno derivado de la marca se lee
  como una decisión. Rediseño del 18/9.
- Cada token tiene valor claro y oscuro. Un componente no sabe en qué modo está.
- Cada par texto/fondo declarado aquí tiene su ratio calculado y un test que lo verifica.
- Los estados del dominio son tokens de primera clase: el "con cuota vencida" y el
  "bloqueado" no se improvisan con un rojo.

## Superficies

| Token            | Uso                                      |
| ---------------- | ---------------------------------------- |
| `surface.canvas` | Fondo de pantalla                        |
| `surface.base`   | Cards, paneles, el player                |
| `surface.sunken` | Pozos: chips, barras de progreso, campos |
| `surface.raised` | Diálogos, menús                          |
| `surface.note`   | Fondo de los avisos `role="note"`        |

## Texto

`text.default` · `text.muted` (metadatos) · `text.subtle` (deshabilitado, ≥ 4.5:1 igualmente
sobre `surface.base`) · `text.onAccent` · `text.link` (subrayado siempre; el color no basta).

## Acento y estado

| Token            | Significado                                                                                                                     | Siempre acompañado de                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `accent.base`    | Acción principal, activo, "siguiente"                                                                                           | —                                           |
| `status.success` | Completado, aprobado, al día                                                                                                    | icono check + texto                         |
| `status.warning` | Cuota próxima, tiempo < 5 min                                                                                                   | icono + texto                               |
| `status.error`   | Cuota vencida, reprobado, tiempo vencido                                                                                        | icono + texto                               |
| `status.info`    | Financiado por aliado, en acuerdo de pago                                                                                       | icono + texto                               |
| `status.locked`  | Tema bloqueado en progresión lineal                                                                                             | icono candado + "Se habilita al completar…" |
| `status.legacy`  | ~~Contenido pendiente de conversión~~ — sin consumidor desde el 18/9; el token sigue en el contrato y en la prueba de contraste | `role="note"` con texto                     |

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
`caption` (metadatos) · `overline` (etiquetas de sección, mayúsculas con tracking) ·
`label` (texto dentro de un control: botón, chip, pestaña) · `body-emphasis` (tamaño de
`body`, peso 600 — la única forma de destacar sin cambiar de rol; prohibido `font-medium`
y compañía sobre un rol). Fórmulas: MathML hereda `body`.

**Familia** (`font.sans`): Atkinson Hyperlegible Next, self-hosted en
`apps/web/app/fonts/`, expuesta como `--font-sans`. Es un token: el respaldo es el stack
del sistema, así que si la variable no existe nada se rompe. `data` depende de la feature
`tnum` de la fuente — verificarla antes de cambiar de familia
(`apps/web/app/fonts/README.md`).

**Interlineado**: rampa monótona, el texto grande se aprieta y el pequeño se abre —
`display` 1.2 · `heading` 1.25 · `subheading` 1.3 · `body` 1.5 · `data` 1.5 ·
`caption` 1.5 · `label` 1.4 · `overline` 1.4. Ratios, nunca valores absolutos: el
interlineado tiene que escalar con `reading.fontScale` y con el zoom del navegador.

**Tracking**: solo donde corrige una distorsión óptica, calibrado para esta familia —
`display` −0.015em (el texto grande se ve suelto) · `caption` +0.01em · `label` +0.01em ·
`overline` +0.05em (mayúsculas). El resto, cero.

## Foco

`focus.ring` = color (≥ 3:1 contra cualquier superficie), grosor 3 px, offset 3 px. Un solo
`:focus-visible` global; ningún componente define el suyo. Nunca oculto por barras fijas.

## Espaciado, radios, tamaños

`space.{1,2,3,4,6,8,12}` en `rem` · `radius.{control,card,sheet,pill}` ·
`size.touchMin = 44px` (mínimo de toque, siempre) · `size.readingWidth = 68ch` (el Markdown
no se estira más) · `elevation.{none,resting,floating,modal}`.

**Radios (18/9)**: `control` 8 · `card` 16 · `sheet` 20 · `pill`. Cuatro con rol distinto y no
uno para todo; entre 6 y 8 px la diferencia entre un control y una tarjeta no se veía. `card`
subió de 12 a 16 al pasar la aplicación a lienzo gris con tarjetas blancas: con fondo por
debajo, 12 px dejaba la tarjeta con aire de caja.

**`elevation.resting` (18/9)**: una sombra muy baja para la tarjeta en reposo. **La tarjeta
sigue agrupando por el borde**: en oscuro una sombra no se ve, así que si la agrupación
dependiera de ella, la tarjeta dejaría de agrupar al cambiar de tema. Quitar la sombra no
rompe nada; quitar el borde sí.

**Contraste medido (18/9)**: 35 pares × 2 temas = 70 comprobaciones, 0 fallos. Holgura mínima
**+0.53**. Los cinco pares nuevos son los de la píldora de estado (`atoms/badge`): el color
del estado sobre su propio fondo suave. Entraron al contrato porque medirlos una vez y
anotarlos en un comentario es lo que dejó `text.subtle / surface.sunken` en 1.05 durante
meses. Al añadirlos, `status.success.base` y `status.warning.base` bajaron un escalón en
claro: daban 4.57 y 4.51 sobre un mínimo de 4.5.

## Marca (19/9)

El manual de marca de Colombia Estudia fija Azul Principal `#0047BA`, Azul Oscuro `#0D2E6E`,
Amarillo Inspiración `#F5C400`, Rojo Impulso `#D72638`, Gris Claro `#F3F5F8` y la familia
Lexend. Lo que entra al producto, y lo que no, con el motivo:

- **`accent.base` claro = `#0047BA`** (8.04 sobre blanco). `hover` `#0052D6`; `active` es el
  Azul Oscuro `#0D2E6E`. `text.link` va con el acento. Sustituye al `#123B7A` del 18/9.
- **`status.info` claro = el mismo azul que el acento.** Dos azules casi iguales conviviendo
  (`#1D4ED8` daba 1.20:1 contra `#0047BA`) era peor que uno; la píldora se distingue del botón
  por la forma.
- **`focus.ring` claro = `#0D2E6E`.** El anillo lleva `outline-offset: 3px`, nunca está sobre
  el botón sino sobre la superficie: lo que se mide es anillo / superficies (12.86 sobre
  blanco), y por eso puede ser de la familia del acento. El amarillo quedó descartado como
  anillo: 1.64 sobre blanco.
- **`surface.canvas` claro = `#F3F5F8`**, el Gris Claro del manual; `surface.sunken` baja a
  `#EAEEF4` para seguir un escalón por debajo.
- **El tema oscuro no cambia.** `#0047BA` sobre `#0B1220` da 2.33:1; `#8FB6F0` es el mismo
  tono (214° frente a 217°) a la luminosidad que el fondo exige.
- **`brand.yellow` `#F5C400`** entra como token de marca, igual en los dos temas: logo,
  subrayado corto bajo el título de área (`PageHeader`) y **fondo del CTA de la web pública**
  (`Button variant="brand"`, solo en `features/marketing`). Lo único que se escribe encima es
  `brand.onYellow` `#0C1522` (11.15, en el contrato). Nunca texto, icono ni único indicador
  de estado, y nunca CTA dentro de la app: un botón amarillo ahí se leería como aviso
  (`warning.muted`, `surface.note` viven en esa familia). `brand.red` `#D72638` es solo del
  logo y de las formas decorativas de la portada (`brand-shapes.tsx`).
- **El rojo `#D72638` no entra.** Un error no es un momento de marca y el `#BE1D1D` actual
  tiene más holgura (5.27 sobre `error.muted`; el del manual daría 4.20 y fallaría).
- **El logo (19/9)** vive en `apps/web/public/brand/` y se pinta con `atoms/brand-logo`: a
  color en claro y la variante blanca del manual en oscuro, elegidas por CSS (`only-light` /
  `only-dark`, dos utilidades del plugin que cubren `.dark` y `.theme-system`). Sin sombra,
  sin contenedor, sin rotar, como manda el manual. Ojo: los colores del PNG (`#002C80`,
  `#CC001C`, `#F8BC00`) no son los del manual; ver `docs/brand/README.md`.
- **Lexend no entra**: Atkinson Hyperlegible Next se queda por `tnum` (decisión 17/9). Lexend
  es de la marca (logo, web pública), no del producto.
- **La web pública tiene piel propia** (Jhonny, 19/9): `apps/web/features/marketing/site.css`
  bajo `.site`, con Lexend y su propia escala, paleta del manual y radios; no sigue estos
  tokens al pie de la letra porque es la presentación ante un posible alumno. Del plugin usa
  solo `max-w-site` (1240 px), `theme-light-scope` (siempre clara; hace que `--focus-ring` y
  `only-*` resuelvan) y `brand.*` para el logo. Comparte lo no negociable: AA, foco visible,
  44 px, HTML semántico. Dentro del producto `display` sigue en 30 px y el marco en 64rem.

Contrato tras el cambio: 36 pares × 2 temas (el 36.º es `brand.onYellow / brand.yellow`), 0 fallos; holgura mínima en claro +0.53
(`status.warning.base / status.warning.muted`, 5.03, sin cambio), en oscuro +1.22.

## Tema (18/9)

**Claro por defecto; oscuro y «el de mi equipo» se eligen.** Antes mandaba
`prefers-color-scheme` y la aplicación obedecía al sistema operativo sin que nadie lo hubiera
decidido. Ahora el suelo es el claro (`:root`), `.dark` es la elección explícita y
`.theme-system` es lo único que activa la consulta de medios.

La elección va en la **cookie** `ce-theme` y la lee el layout raíz, que ya es `force-dynamic`:
el HTML sale del servidor con la clase puesta y no hay ni un fotograma del tema equivocado.
No se usa un `<script>` en línea que lea `localStorage` porque el middleware manda una CSP
con `nonce` y `strict-dynamic`, y porque la cookie evita el parpadeo sin ejecutar nada.
`color-scheme` acompaña a cada tema para que los `select`, la barra de desplazamiento y los
selectores de fecha que pinta el navegador vayan con el resto.

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
portador de estado; sombras a mano; emojis en UI; `brand.yellow` como texto, icono o estado.
