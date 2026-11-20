# Videos de repaso por tema (ALBA)

Decisión del 18/11: cada tema del taller termina con un paso «Repaso: <tema>», un video corto (≈1 min) con animación de marca al inicio y al final. Horizontal 1920×1080, 30 fps. Remotion 4, independiente del monorepo (no está en `pnpm-workspace.yaml`; knip ignora `videos/**`).

## Guiones

Un JSON por tema en `temas/<componente>/<tema>.json`: metadatos (`tema`, `componente`, `area`, `titulo`, `siguiente`) y `escenas`. Cada escena tiene `texto` (subtítulos) y `voz` (lo que se lee, números en letras), con las mismas frases, y un `tipo`:

| Tipo        | Para qué                                  | Datos                                              |
| ----------- | ----------------------------------------- | -------------------------------------------------- |
| `portada`   | Entrada de marca con el título del tema   | —                                                  |
| `linea`     | Fechas o momentos en orden                | `items[]`: `etiqueta`, `titulo`, `texto`           |
| `pasos`     | Una secuencia (de la célula al organismo) | `items[]`: `titulo`, `texto?`                      |
| `ciclo`     | Algo que se repite (ciclo del agua)       | `items[]`: `titulo`, `texto?`                      |
| `conceptos` | Ideas sueltas, una tarjeta por idea       | `items[]`: `titulo`, `texto`                       |
| `comparar`  | Dos cosas lado a lado                     | `columnas[2]`: `titulo`, `puntos[]` (`texto`)      |
| `imagen`    | Una ilustración del contenido (20/11)     | `imagenes[]`: `src`, `focos[]` (`x`, `y`, `zoom?`) |
| `cierre`    | «¡Tema repasado!», siguiente paso y logo  | —                                                  |

Cada ítem, columna o punto aparece cuando la voz dice su `palabra` (en minúsculas, como se escribe en `voz`; `vez` elige la ocurrencia, desde 0). Sin `palabra`, se reparten a lo largo de la voz. Los tipos coinciden con los de `:::escena` en las lecciones, salvo `mapa`, que el video no tiene.

## Voces con ElevenLabs

La llave va solo en el entorno de la terminal; nunca en el repo ni en el chat.

```bash
cd videos/repasos
npm install
export ELEVENLABS_API_KEY=…
npm run voces                      # todos los temas
node tools/elevenlabs.mjs la-celula   # uno solo
node tools/timings.mjs
```

`tools/elevenlabs.mjs` usa `eleven_multilingual_v2` con `with-timestamps`: con la hora de cada letra, subtítulos y animaciones quedan sincronizados con la voz. Voz: `JcWDFG8DiES2OzGhZJUJ` (elegida el 19/11); `--voz=<id>` prueba otra. Lo ya generado no se vuelve a pedir; `--force` lo regenera.

La escena `imagen` usa las ilustraciones del contenido (`packages/scripts/seed/contenido/imagenes/<componente>/<id>.webp`): `npm run imagenes` las copia a `public/imagenes/` (no se versionan ahí; `studio` y `render` lo hacen solos). Se usa donde la voz describe lo que muestra la imagen, con un foco por cada parte que nombra.

`tools/timings.mjs` deja `src/timings/<tema>--<voz>.json` (una composición `Repaso-<tema>-<voz>` por cada uno) y `out/repaso-<tema>-<voz>.vtt` con los subtítulos.

## Render

```bash
npx remotion studio src/index.ts
npx remotion render src/index.ts Repaso-la-celula-JcWDFG8DiES2OzGhZJUJ out/repaso-la-celula.mp4 --crf=20
```

El volumen de la música es `MUSICA` en `src/Video.tsx` (0.04 desde el 20/11). Para cambiarlo sin volver a renderizar la imagen: `--codec=aac` saca solo el audio y `ffmpeg -i video.mp4 -i audio.aac -map 0:v -map 1:a -c copy` lo reemplaza.

## Borrador sin conexión (Kokoro)

`kokoro-multi-lang-v1_0.tar.bz2` (releases `tts-models` de k2-fsa/sherpa-onnx) en `tools/`, `pip install sherpa-onnx==1.12.40 soundfile`, `python3 tools/kokoro.py la-celula borrador-dora 28` (29 = voz masculina) y `npm run tiempos`. Sin alineación, los tiempos se reparten por longitud del texto.

## En la plataforma

El MP4 va a Vimeo con su VTT (los recursos de video piden subtítulos revisados) y se registra como recurso. En el taller, después de las actividades del tema, va un tema nuevo «Repaso: <tema>» con `::video{asset="<id>"}`. Se completa al ver el 90 % del video o leer la transcripción (`packages/domain/src/lesson-completion.ts:45`).
