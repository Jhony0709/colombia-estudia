# Marca: ficheros de origen y derivados

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
