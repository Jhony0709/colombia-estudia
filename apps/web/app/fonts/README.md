# Tipografía

`atkinson-hyperlegible-next-var.woff2` — Atkinson Hyperlegible Next, versión 2.001,
variable (eje `wght`), licencia SIL Open Font License 1.1 (`OFL.txt`, que la licencia
obliga a distribuir junto al fichero).

Origen: `google/fonts/ofl/atkinsonhyperlegiblenext/AtkinsonHyperlegibleNext[wght].ttf`.

## Cómo se generó

```sh
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,\
U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,\
U+FEFF,U+FFFD"
FEATURES="ccmp,locl,kern,mark,mkmk,liga,tnum,frac,numr,dnom,sups,subs,zero,case,ordn"

# 1. recortar el eje de peso a lo que usan los roles tipográficos
python3 -m fontTools.varLib.instancer "AtkinsonHyperlegibleNext[wght].ttf" \
  wght=400:700 -o axis-limited.ttf

# 2. subset al rango latin + conversión a woff2
python3 -m fontTools.subset axis-limited.ttf \
  --unicodes="$LATIN" --layout-features="$FEATURES" \
  --flavor=woff2 --output-file=atkinson-hyperlegible-next-var.woff2
```

Requiere `fonttools` y `brotli`.

Con el eje completo (200–800) el fichero pesa 33,5 KB; recortado a 400–700, 20,1 KB.
Si algún rol llegara a necesitar un peso fuera de 400–700, hay que regenerarlo.

## Qué hay que volver a comprobar si se cambia de fuente

La feature `tnum`. `.type-data` aplica `font-variant-numeric: tabular-nums` y de eso
dependen las tablas, las notas, las cuotas y el cronómetro. Una fuente sin `tnum`
convierte esa regla en letra muerta sin que nada falle ni avise:

```sh
python3 -c "
from fontTools.ttLib import TTFont
f = TTFont('<fuente>')
feats = {fr.FeatureTag
         for t in ('GSUB','GPOS') if t in f
         for fr in f[t].table.FeatureList.FeatureRecord}
print('tnum:', 'tnum' in feats)
"
```
