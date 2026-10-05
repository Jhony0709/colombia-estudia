# Marca: ficheros de origen y derivados

## ALBA Futuro Educativo (rebranding, 5/10)

El cliente aprobó la marca **ALBA Futuro Educativo**: `alba-brand-board.png` (logo, paleta,
Lexend, valores, sistema gráfico) y `alba-landing-reference.png` (mockup de la portada,
escritorio y teléfono). La portada (`apps/web/features/marketing/`) ya sigue esa referencia:
paleta navy `#0D2B5B` · azul `#2563EB` · azul claro `#60A5FA` · amarillo `#FBBF24` · blanco,
superficies `#F8FAFC` / `#EFF6FF` / `#FFF9EC`, texto `#0F172A` / `#334155` / `#64748B`. Del
manual se toma `#2563EB` y no el «Azul Horizonte» `#3B82F6` del tablero: este da 3.68:1 sobre
blanco y no sirve para texto ni botones.

**Logo (5/10).** `alba-isotipo-original.png` es el isotipo tal como llegó (1254 × 1254, RGBA,
solo el símbolo, sin nombre). Sus colores reales: amarillo `#FDC102`, azul claro `#2193FD`,
azul `#057FFD`; no son los de la paleta de la web (`#FBBF24`, `#60A5FA`, `#2563EB`): el logo es
un fichero y se usa tal cual. Derivados (Python + Pillow, sin retoque a mano):

1. alpha < 16 → 0 (un halo casi invisible ensanchaba la caja de 923 a 1125 px) y RGB a negro
   bajo alpha 0; recorte cuadrado a la caja de alpha > 200 con un 2 % de margen
   (`alba-isotipo-1024.png`, el maestro limpio).
2. Variante blanca: el alpha como máscara con relleno blanco; las ranuras entre ondas ya son
   transparentes en el original, así que el símbolo se sigue leyendo.
3. Logo horizontal: isotipo + «ALBA» en Lexend 700 y «FUTURO EDUCATIVO» en Lexend 500 con
   tracking 0.24 em, navy `#0D2B5B` (o blanco), como el tablero de marca.

| Fichero                                       | Qué es                                                  |
| --------------------------------------------- | ------------------------------------------------------- |
| `public/brand/alba-logo-horizontal.png`       | Horizontal a color, 1229 × 400                          |
| `public/brand/alba-logo-horizontal-white.png` | Horizontal blanco, para oscuro                          |
| `public/brand/alba-isotipo.png`               | Isotipo, 256 × 256                                      |
| `public/brand/alba-isotipo-white.png`         | Isotipo blanco                                          |
| `app/icon.png`                                | Favicon, isotipo sobre transparente, 512 × 512          |
| `app/apple-icon.png`                          | Isotipo a color sobre navy, 180 × 180 (tablero: app)    |
| `app/opengraph-image.png`                     | Logo + «Tu historia también puede continuar.», 1200×630 |

Los nombres llevan `alba-` a propósito: con el mismo nombre que los de Colombia Estudia, la caché
de imágenes de Next y la del navegador seguían sirviendo el logo viejo. Los usan `BrandLogo`
(producto) y `AlbaLogo` (portada). Pendiente: el vector (SVG) y, si se quiere, pasar los tokens
del producto (`design-tokens`: acento `#0047BA`, `brand.yellow`, `brand.red`) a la paleta ALBA.
El rojo deja de ser color de marca.

## Colombia Estudia (19/9) — histórico

Lo que sigue describe los ficheros de la marca anterior; los `public/brand/*.png` de esa
marca ya no existen (sustituidos el 5/10 por los `alba-*`).

`colombia-estudia-logo-original.png` es el logo tal como llegó (19/9): PNG RGBA de 1536 × 1024,
sin vector. `colombia-estudia-isotipo-original.png` es el isotipo suelto ("logo solo", 1254 ×
1254, RGBA) que llegó después y del que salen ahora `isotipo*.png`, `icon.png` y
`apple-icon.png`. Ojo: sus colores (`#003CA0`, `#FCCC00`, `#DC0028`) tampoco coinciden con los
del logo horizontal ni con el manual; son dos exportaciones distintas del mismo dibujo. Los colores reales del fichero, medidos sobre los píxeles opacos, son azul
`#002C80`, rojo `#CC001C` y amarillo `#F8BC00`. **No coinciden con el manual de marca**
(`#0047BA`, `#D72638`, `#F5C400`): el azul del logo está a 1.02:1 del "Azul Oscuro" `#0D2E6E`
del manual y a 1.56:1 del "Azul Principal". Queda registrado; la decisión de cuál es la verdad
es de Jhonny y del diseñador del manual. Los tokens siguen el manual.

Derivados en `apps/web/public/brand/` y `apps/web/app/` (favicon, icono de iOS/Android e
imagen de Open Graph por convención de Next):

| Fichero                                  | Qué es                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `public/brand/logo-horizontal.png`       | Recorte del original (isotipo + wordmark), 800 px de ancho            |
| `public/brand/logo-horizontal-white.png` | Variante blanca del manual ("blanco sobre azul"), para el tema oscuro |
| `public/brand/isotipo.png`               | Solo el isotipo, 256 px de alto                                       |
| `public/brand/isotipo-white.png`         | Isotipo blanco, para el tema oscuro                                   |
| `app/icon.png`                           | Favicon: isotipo a color sobre transparente, 512 × 512                |
| `app/apple-icon.png`                     | Isotipo blanco sobre `#0047BA`, 180 × 180 (manual: "App icon")        |
| `app/opengraph-image.png`                | Logo sobre blanco, 1200 × 630                                         |

Cómo se hicieron (Python + Pillow, sin retoque manual):

1. El RGB bajo los píxeles con alpha 0 se pone a negro: el original guarda ahí un "resplandor"
   difuminado que no se ve con el canal alpha pero sí en visores que lo ignoran.
2. Recorte a la caja de alpha > 200 con 24 px de margen; isotipo = la parte izquierda (x < 600).
3. Variante blanca: el alpha del original como máscara, relleno blanco, y una ranura
   transparente de ~5 px a lo largo de cada frontera entre colores (azul/amarillo/rojo),
   que es lo que hace la versión "blanco sobre azul" del manual: sin ella el isotipo se
   convierte en una silueta sin birrete.
4. Redimensionado con Lanczos; PNG optimizado.

Por qué la variante blanca en oscuro y no la de color: el azul del logo da 1.49:1 sobre el
lienzo oscuro (`#0B1220`) y 1.33:1 sobre las tarjetas. El wordmark se lee a duras penas.

Pendiente: el vector (SVG). Con él, estos PNG se sustituyen y el favicon puede ser SVG.

## Portada: referencia visual y fotografías pendientes

`landing-reference.png` es el mockup que Jhonny trajo el 19/9 y del que la portada toma la
composición (no el modelo de negocio: ver PRODUCT_DECISIONS.md). Las fotografías definitivas
no existen; cada hueco está declarado en `apps/web/features/marketing/media.ts` (`MEDIA_SLOTS`)
con su relación de aspecto y su encargo, y se rellena en `MEDIA` sin tocar el layout:

| id                     | Aspecto | Qué debe mostrar                                                            |
| ---------------------- | ------- | --------------------------------------------------------------------------- |
| `hero-student`         | 4:5     | Estudiante de cuerpo medio, vertical, fondo neutro o recortable             |
| `hero-city`            | 5:4     | Ciudad o paisaje colombiano luminoso, sin texto; queda detrás de la persona |
| `editorial-colombia`   | 3:2     | Patrimonio o paisaje; el panel blanco tapa la mitad derecha                 |
| `banner-student`       | 4:5     | Persona con portátil o audífonos; fondo oscuro o azul                       |
| `final-students`       | 3:2     | Dos o tres estudiantes sonriendo, horizontal                                |
| `program-bachillerato` | 16:9    | Aula, tutoría o estudiante adulto, horizontal                               |

Estado 19/9: las seis existen, **generadas** con los prompts que se dieron ese día y
optimizadas en `apps/web/public/photos/` (JPEG q82; `hero-student` en WebP con alpha tras
recortar el fondo con rembg). Valen como ilustración de marketing; el manual pide personas
reales y diversas, y eso sigue pendiente del cliente. Nunca junto a un nombre, un testimonio o
una cifra. Los originales PNG (12 MB) no están en el repo: quedaron en `_to_delete/` para que
Jhonny decida dónde guardarlos.
