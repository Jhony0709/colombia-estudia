---
name: ui-craft-colombia-estudia
description: Artesanía UI de Colombia Estudia. Usar antes de crear o editar cualquier componente visual, y para el barrido /audit-ui. Catálogo de anti-patrones ligado al contrato de tokens y al contrato de accesibilidad (colores, tipografía, espaciado, superficies, estados, a11y), con comandos de detección concretos para Next.js + Tailwind.
---

# UI Craft Colombia Estudia

Herencia de ui-craft-don-pepo ADAPTADA a web (Next.js App Router, Tailwind con variables
CSS, Radix) y a un público que estudia desde el celular, a veces con lector de pantalla.
**Precedencia: `reference/03-ui/tokens.md`, `reference/03-ui/accesibilidad.md` y
`DESIGN.md` ganan sobre cualquier opinión externa o default de modelo.**

## Anti-patrones (detección → arreglo)

### AP1 — Color literal fuera de design-tokens

**Detección**: `rg -n '#[0-9a-fA-F]{3,8}|rgb\(|hsl\(' apps/web/app apps/web/components --type tsx --type css | rg -v 'design-tokens|tokens\.'`
y clases Tailwind de paleta cruda: `rg -n '\b(bg|text|border)-(red|green|blue|gray|slate|zinc|amber|yellow)-[0-9]{3}\b' apps/web --type tsx`
**Arreglo**: `bg-surface-base`, `text-status-overdue`, etc. Los valores solo viven en
`packages/design-tokens`; Tailwind los expone como variables CSS.

### AP2 — Tamaño de texto fuera de la escala

**Detección**: `rg -n 'text-\[|font-size:|text-(xs|sm|base|lg|xl|2xl)\b' apps/web --type tsx | rg -v 'type-'`
**Arreglo**: clases de rol `type-body`, `type-data`, `type-heading`… El Markdown del player
se renderiza en `type-body` con `max-w-reading`. Números en columna: `tabular-nums`.

### AP3 — Espaciado, radio o tamaño literal

**Detección**: `rg -n '(p|m|gap|space|rounded|w|h)-\[[0-9]' apps/web --type tsx`
**Arreglo**: `space.*`, `radius.*`, `size.touchMin`. Nada por debajo de 44×44 en player,
evaluación y cartera.

### AP4 — Estado transmitido solo por color

Caso típico: una fila "en mora" en rojo y nada más. **Detección**: buscar `status-` sin
icono ni texto hermano en el mismo nodo: revisión de stories. **Arreglo**: componente
`StatusChip` (icono + texto + color) para todo estado del glosario. Nunca un punto de color.

### AP5 — Jerarquía de superficies rota

`canvas → sunken → base → raised`. Cards anidadas = `sunken` dentro. `surface.note` solo
para avisos `role="note"`. **Detección**: `rg -n 'bg-surface-base' apps/web --type tsx` y
revisar padres.

### AP6 — Sombra o elevación a mano

**Detección**: `rg -n 'shadow-\[|box-shadow' apps/web --type tsx --type css`
**Arreglo**: `elevation-{0..3}`.

### AP7 — Copy que contradice el glosario

"En mora", "bloqueado", "usuario", "curso", "grupo". **Detección**:
`rg -n -i '\b(en mora|bloqueado|usuario|curso|grupo)\b' apps/web/messages` **Arreglo**:
tabla "Etiquetas de estados" de `reference/09-glossary.md`. Todo texto vive en
`messages/es-CO.json`, nunca en el componente.

### AP8 — Targets, foco y lector de pantalla

Fila presionable = UN solo elemento interactivo con nombre completo; iconos decorativos
`aria-hidden`; foco visible (nunca `outline-none` sin `focus-visible:`); `<iframe title>`;
"Saltar el video" antes del iframe. **Detección**: `rg -n 'outline-none' apps/web --type tsx | rg -v 'focus-visible'`
y axe en Playwright.

### AP9 — Regiones vivas mal usadas

Cronómetro con `aria-live` (interrumpe cada segundo); toasts efímeros para errores; estado
sin `role="status"`. **Detección**: `rg -n 'aria-live' apps/web --type tsx` y revisar cada
uso contra la fila "Cronómetro" y "Mensajes de estado" del contrato de accesibilidad.

### AP10 — Markdown renderizado con HTML crudo o sin semántica

El contrato prohíbe HTML crudo; el render debe producir `<h2>…`, `<figure>`, `<span lang>`,
MathML. **Detección**: `rg -n 'dangerouslySetInnerHTML' apps/web --type tsx` fuera del
renderizador de contenido. **Arreglo**: el único `dangerouslySetInnerHTML` permitido es el
del renderizador, sobre HTML producido por el parser del contrato y saneado.

### AP11 — «Beige AI» y defaults de modelo

Grises neutros inventados, degradados decorativos, emojis en UI, cards con icono grande y
frase motivacional. La paleta y la voz son las de `DESIGN.md`.

## /audit-ui — barrido completo

1. Correr AP1–AP3, AP6, AP8, AP9, AP10 (rg) sobre el área tocada o todo `apps/web`.
2. Triage de cada hallazgo: **(a)** migrar a token ahora · **(b)** excepción documentada
   (hoy ninguna) · **(c)** deuda fichada en `docs/estado.md`, nunca en silencio.
3. Revisar AP4, AP5, AP7, AP11 a ojo en los archivos tocados y sus stories.
4. Correr `pnpm a11y` (pa11y-ci + axe) sobre las rutas tocadas.
5. Reportar: hallazgos por AP con archivo:línea y arreglo. Cero hallazgos también se
   reporta.

## Reglas de convivencia

- Componentes retirados NO se borran.
- Pruebas en dispositivo y con lector de pantalla: Jhonny.
- Ámbito: web. Si algún día hay móvil nativo, mismo contrato de tokens, catálogo de
  don-pepo como referencia.
