---
name: motion-colombia-estudia
description: Doctrina de animación de Colombia Estudia (web, framer-motion + CSS). Usar SIEMPRE antes de crear, editar o revisar cualquier animación o transición. Vocabulario acordado, reglas no negociables y checklist, ligados a los tokens de motion y al contrato de accesibilidad.
---

# Motion Colombia Estudia

Destilado de motion-don-pepo ADAPTADO a web y a un producto donde la animación tiene que
justificarse dos veces: por propósito y por accesibilidad. **Precedencia: el contrato de
tokens (`reference/03-ui/tokens.md` → `SemanticTokens.ts`) y el contrato de accesibilidad
ganan sobre esta skill, y esta skill gana sobre cualquier skill externa o intuición.**

## Vocabulario acordado

- **corte / corte seco**: sin animación. Es la rama `prefers-reduced-motion` y también una
  decisión válida de diseño.
- **fade**: solo opacidad, `easing.exit`, `duration.normal`. La salida de diálogos y
  paneles es fade en el sitio.
- **grow**: entrada de diálogo o sheet desde el 96 % con fade; nunca desde un punto.
- **crossfade**: dos capas intercambiando opacidad (cambio de pregunta en el intento).
- **deslizar**: solo para sheets desde el borde inferior en móvil y para el panel de
  transcripción. Nada más se desliza.
- **pulse / parpadeo**: PROHIBIDO en texto y en el cronómetro. Veto explícito.

## Doctrina (reglas no negociables)

1. **Tokens siempre**: `duration.*` y `easing.*` del contrato. Cero `ms` o curvas literales.
2. **Uso por token**: `instant` = cambios sin percepción · `fast` = feedback de press/foco ·
   `normal` = transiciones de contenido · `slow` = solo la celebración de "cohorte
   completada", una vez.
3. **`prefers-reduced-motion` = corte seco**, en toda animación, ambos sentidos. Se prueba
   con la media query activada en Playwright.
4. **La salida es más simple que la entrada**: grow → fade; deslizar → fade o corte.
5. **Solo `transform` y `opacity`**. Nada que dispare layout por frame. Los acordeones de
   módulos usan `grid-template-rows: 0fr → 1fr`, la excepción medida.
6. **Interrumpible**: framer-motion con `AnimatePresence` y `layout` donde aplique; nunca
   `setTimeout` encadenados.
7. **Test de propósito**: si no aclara origen/destino, no da feedback o no orienta, no va.
   El movimiento decorativo se rechaza en revisión.
8. **Nada parpadea más de 3 veces por segundo** (WCAG 2.3.1). El cronómetro cambia el
   número; los hitos se anuncian en la región viva, no con animación.
9. **Progreso**: la barra crece con `normal`; el `100 %` no celebra salvo la cohorte completada.
10. **Foco**: nunca se anima el anillo de foco; aparece con corte.
11. **Sombras**: solo `elevation.*`.
12. **La doctrina de uso de cada token vive en el contrato**; esta skill la resume.

## Checklist de revisión

- [ ] ¿Duraciones y easing salen de tokens?
- [ ] ¿Hay rama `prefers-reduced-motion` con corte seco en ambos sentidos, probada?
- [ ] ¿La salida es más simple que la entrada?
- [ ] ¿Solo `transform`/`opacity` (o `grid-template-rows` en acordeones)?
- [ ] ¿Es interrumpible?
- [ ] ¿Pasa el test de propósito?
- [ ] ¿Parpadea, pulsa o anima texto o el cronómetro? → no pasa.
- [ ] ¿Algún `ms`, curva, sombra o spring literal? → no pasa.

## Implementaciones canónicas (a crear en fase 4; leer antes de hacer algo parecido)

- Diálogo: `apps/web/components/molecules/dialog/` (grow + fade, Radix Dialog + framer).
- Sheet inferior móvil: `…/molecules/sheet/`.
- Acordeón de módulos: `…/organisms/program-outline/`.
- Cambio de pregunta: `…/organisms/attempt-player/` (crossfade).

## Ámbito

Web (Next.js, framer-motion, CSS). Si hay móvil nativo algún día: mismas reglas, mismos
tokens, doctrina de don-pepo para Reanimated.
