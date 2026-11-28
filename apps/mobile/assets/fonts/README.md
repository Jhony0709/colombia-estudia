# Tipografía de la app

Atkinson Hyperlegible Next en tres caras estáticas: 400 (`Regular`), 600 (`SemiBold`) y 700
(`Bold`). Salen del mismo variable que usa la web (`apps/web/app/fonts/atkinson-hyperlegible-next-var.woff2`,
eje `wght` 400–700, subset latin; ver `apps/web/app/fonts/README.md`). Licencia SIL OFL 1.1
(`OFL.txt`, que la licencia obliga a distribuir junto a los ficheros).

React Native no carga woff2 ni, en Android, un variable con su eje: por eso caras estáticas.

```sh
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
f = TTFont('atkinson-hyperlegible-next-var.woff2'); f.flavor = None; f.save('var.ttf')
for w, name in [(400, 'Regular'), (600, 'SemiBold'), (700, 'Bold')]:
    instancer.instantiateVariableFont(TTFont('var.ttf'), {'wght': w}, updateFontNames=True).save(
        f'AtkinsonHyperlegibleNext-{name}.ttf')
PY
```

Requiere `fonttools` y `brotli`. Las tres caras conservan la feature `tnum`.
