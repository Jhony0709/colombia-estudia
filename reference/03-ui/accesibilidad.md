# 03 — Contrato de accesibilidad

Objetivo: **WCAG 2.2 nivel AA** en toda la plataforma. Es un superconjunto de 2.1 AA, que
es lo que la Resolución MinTIC 1519 de 2020 exige a las entidades públicas; lo adoptamos
aunque el cliente sea privado porque es contra lo que nos medirían y porque el Decreto
1421 de 2017 hace de la inclusión una obligación de toda institución de educación formal.
(EAA, EN 301 549 y RGAA son marcos europeos: no aplican en Colombia.)

No es una fase. Es una restricción de cada componente, cada pantalla y cada contenido, y
un requisito no funcional al mismo nivel que seguridad, privacidad y rendimiento. El
público real: adultos que estudian de noche desde el celular con datos limitados.

## Tres principios por encima de WCAG

1. **Todo video tiene alternativa textual** (transcripción sincronizada; subtítulos revisados
   para lo nuevo). Si el video dice "como pueden ver aquí", el texto de la lección explica
   lo que se ve.
2. **Toda actividad educativa se completa sin depender exclusivamente de ratón, color,
   sonido o tiempo estándar.**
3. **La accesibilidad nunca impide medir correctamente el aprendizaje.** El tiempo extra, los
   subtítulos o el teclado no son una ventaja: quitan una barrera que no forma parte de la
   competencia evaluada. Por eso el ajuste se congela en el intento y no cambia la nota.

## Lo que Radix ya resuelve (y por eso lo usamos)

Foco, navegación por teclado y ARIA en diálogos, menús, tabs, selects, tooltips, radios y
checkboxes; al cerrar un diálogo el foco vuelve al disparador. No reimplementes ninguno de
esos primitivos ni rompas ese retorno.

## Lo que Radix no resuelve y es responsabilidad nuestra

| Área                                            | Regla                                                                                                                                                                                                                                                                                                                                                                                                   | Verificación                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Contraste (1.4.3, 1.4.11)                       | 4.5:1 texto, 3:1 texto grande y UI. Solo pares de `tokens.md`, con ratio calculado y test                                                                                                                                                                                                                                                                                                               | pa11y-ci + addon a11y de Storybook + test de tokens  |
| Color no es el único medio (1.4.1)              | Todo estado lleva icono **y** texto; el progreso lleva número ("8 de 10 temas") además de barra                                                                                                                                                                                                                                                                                                         | Revisión de stories                                  |
| Reflow (1.4.10)                                 | Usable a 320 px CSS sin scroll horizontal; tablas en contenedor con scroll propio                                                                                                                                                                                                                                                                                                                       | Playwright a 320 px en player, evaluación, cartera   |
| Espaciado de texto (1.4.12)                     | Nada se corta con line-height 1.5, párrafo 2×, letra 0,12 em                                                                                                                                                                                                                                                                                                                                            | Bookmarklet en la revisión manual                    |
| Zoom (1.4.4)                                    | 200 % sin pérdida; texto en `rem`                                                                                                                                                                                                                                                                                                                                                                       | Playwright viewport reducido                         |
| Idioma (3.1.1, 3.1.2)                           | `<html lang="es-CO">`; contenido con `Lesson.language`; fragmentos con `:lang[]{}` → `<span lang>`                                                                                                                                                                                                                                                                                                      | jsx-a11y + validación de publicación                 |
| Saltar bloques (2.4.1)                          | Enlace "Ir al contenido" en todo layout                                                                                                                                                                                                                                                                                                                                                                 | pa11y-ci                                             |
| Títulos (2.4.2)                                 | `{Pantalla} · {Cohorte} · {Institución}` por ruta                                                                                                                                                                                                                                                                                                                                                       | Test e2e                                             |
| Orden y gestión del foco (2.4.3, 2.4.7, 2.4.11) | Foco al `h1` tras navegación programática, tras cerrar diálogos, tras entregar; **un solo token `focus.ring`** (3 px, offset 3 px) para todo; nunca oculto por barras fijas; nunca `outline: none` sin sustituto                                                                                                                                                                                        | Test e2e por teclado + `FocusManager`                |
| Sin trampa de teclado (2.1.2)                   | Iframe de Vimeo con enlace "Saltar el video" antes; CodeMirror: Escape suelta Tab, con ayuda visible                                                                                                                                                                                                                                                                                                    | Test e2e por teclado                                 |
| HTML semántico primero                          | `<button>`, no `<div onClick>`; `header/nav/main/section/article/footer`; ARIA solo cuando HTML no alcanza                                                                                                                                                                                                                                                                                              | jsx-a11y + revisión                                  |
| Formularios (1.3.5, 3.3.1-3.3.3, 3.3.7)         | `<label>` visible (nunca solo placeholder); `autocomplete` en identidad; errores con `aria-describedby`, `role="alert"` y sugerencia de arreglo; no pedir dos veces el mismo dato                                                                                                                                                                                                                       | axe en Playwright                                    |
| Prevención de errores (3.3.4)                   | Confirmación con resumen antes de: entregar intento (lista preguntas sin responder), registrar pago, firmar acuerdo, publicar, retirar matrícula                                                                                                                                                                                                                                                        | Test e2e                                             |
| Autenticación accesible (3.3.8)                 | Email + contraseña con gestores de contraseñas y pegar funcionando; enlace mágico como alternativa; sin CAPTCHA visual ni puzzles: rate limiting en su lugar                                                                                                                                                                                                                                            | Test e2e                                             |
| Ayuda consistente (3.2.6)                       | Bloque "Ayuda" con contacto de la institución en el mismo lugar en todo layout                                                                                                                                                                                                                                                                                                                          | pa11y-ci                                             |
| Etiqueta en el nombre (2.5.3)                   | El texto visible del botón está en su nombre accesible                                                                                                                                                                                                                                                                                                                                                  | axe                                                  |
| Mensajes de estado (4.1.3)                      | Guardado, sin conexión, entregado: `role="status"` por `useAnnounce()`; errores persistentes hasta cerrar, duplicados en una lista accesible. No toasts efímeros para errores                                                                                                                                                                                                                           | Revisión con lector de pantalla                      |
| Cronómetro (2.2.1)                              | `role="timer"` visible **sin** `aria-live`; región `polite` aparte que anuncia solo hitos (mitad, 10, 5, 1 min); `assertive` al vencer; el estudiante puede ocultar el reloj sin perder avisos; extensión según `Accommodation`                                                                                                                                                                         | Test unitario de `attempt-policy` + e2e              |
| Intento (lector de pantalla)                    | Cada pregunta: "Pregunta 3 de 10" como encabezado, `fieldset`/`legend` con el enunciado, `radiogroup` o `group` de checkboxes, ayuda con `aria-describedby`; una pregunta por pantalla en móvil; al calificar, el resultado se anuncia según `reviewPolicy` ("Respuesta correcta. 2 puntos")                                                                                                            | Test e2e "completar una evaluación solo con teclado" |
| Movimiento (2.3.1, 2.3.3)                       | `prefers-reduced-motion` = corte seco; nada parpadea > 3/s; sin parallax ni auto-scroll                                                                                                                                                                                                                                                                                                                 | Doctrina `motion-colombia-estudia`                   |
| Objetivos (2.5.8)                               | ≥ 44×44 CSS px en player, evaluación y cartera; icono de 18 px con área de 44                                                                                                                                                                                                                                                                                                                           | Storybook                                            |
| Arrastre (2.5.7)                                | Siempre con alternativa por teclado; ninguna pregunta se responde solo arrastrando                                                                                                                                                                                                                                                                                                                      | Test e2e                                             |
| Encabezados                                     | Un `h1` por página; sin saltos de nivel; el Markdown se renderiza bajo el `h1` del tema                                                                                                                                                                                                                                                                                                                 | pa11y-ci + validación de publicación                 |
| Video (1.2.2, 1.2.3, 1.2.5)                     | Player de Vimeo (no construimos uno): `<iframe title="Video: {tema}">`; subtítulos **revisados** (`AUTO` no cumple 1.2.2) para lo nuevo; **transcripción sincronizada** (WebVTT) debajo, cada bloque es un botón que lleva a ese segundo; "Ver solo la transcripción" no carga el iframe; leerla hasta el final es evidencia equivalente; contenido visual esencial explicado en el texto de la lección | Validación de publicación + e2e                      |
| Imágenes (1.1.1)                                | En una lección no hay imágenes decorativas: si no aporta, no va; `alt` descriptivo siempre. Un gráfico o diagrama con datos lleva `alt` corto **y** una tabla o texto con los datos                                                                                                                                                                                                                     | Validación de publicación                            |
| Fórmulas                                        | LaTeX → MathML nativo (o KaTeX con MathML), LaTeX fuente como respaldo                                                                                                                                                                                                                                                                                                                                  | Validación de publicación                            |
| Preferencias de lectura                         | Tamaño de texto, interlineado, ancho de lectura, transcripción siempre visible, reducir movimiento, alto contraste; en `Person.readingPreferences` y aplicadas por tokens (variables CSS); respetan lo del sistema por defecto                                                                                                                                                                          | Storybook + e2e                                      |

## Contenido de los autores

Es donde muere la accesibilidad y donde ninguna auditoría automática del código llega.
Se resuelve en la transición `publish`, que **rechaza** el contenido que no cumple. Reglas
en `04-business-logic/contenido-y-evaluaciones.md`. El contenido es Markdown, lo que hace
la validación exacta y el render semántico por construcción.

**Legado.** El contenido migrado de LearnDash es en gran parte imagen de página de PDF:
inaccesible por definición. Se publica con excepción auditada y fecha de conversión, con
el texto automático del OCR como alternativa (aviso "puede contener errores"); el player
lo declara (`role="note"`), ofrece zoom/pan, descarga del original y "Pedir versión
accesible"; `/contenido/legado` lo lista hasta que desaparezca.

**El editor también.** Autores con lector de pantalla existen: botón "Subir imagen",
diálogo de `alt`, panel de avisos como lista navegable, vista previa con encabezados reales.

## El módulo de accesibilidad en el código

`apps/web/lib/a11y/` (fase 1): `useAnnounce()` (una única región viva `polite` y una
`assertive`, nada de `aria-live` sueltos), `FocusManager` (foco al `h1` tras navegación,
retorno al disparador), `AccessibilityPreferencesProvider` (`readingPreferences` +
`prefers-reduced-motion` + `prefers-contrast`), `SkipLink`, `VisuallyHidden`. Es SSOT: un
componente que anuncia o mueve el foco por su cuenta no pasa revisión.

## Definition of Done de cualquier componente o pantalla

funcional · responsive y reflow a 320 px · teclado completo · lector de pantalla (VoiceOver
o NVDA) · foco gestionado con `focus.ring` · contraste por tokens · zoom 200 % ·
`prefers-reduced-motion` · story con addon-a11y · axe en el e2e que lo toca · texto en
`messages/es-CO.json`.

## Gates de CI (bloqueantes, no informativos)

```
eslint-plugin-jsx-a11y      en lint
pa11y-ci                    sobre las rutas del MVP, umbral: 0 errores
@axe-core/playwright        en cada e2e crítico (player, evaluación, mi-cuenta, cartera)
Storybook addon-a11y        en cada story
test de tokens              cada par texto/fondo del sistema ≥ 4.5:1 (o 3:1 donde aplica)
```

Un PR que introduce un error de a11y no se mezcla. Igual que un `type-check` roto. Los
tests automáticos no demuestran que la aplicación es accesible: encuentran lo mecánico.

## Matriz de dispositivos y revisión manual

Por fase, media hora, sobre el vertical slice completo: **Safari iOS + VoiceOver**,
**Chrome Android + TalkBack**, **macOS VoiceOver**, **Windows NVDA + Firefox**, Chrome
de escritorio solo teclado. A 320 px y con espaciado de texto forzado. Lo que se encuentre
ahí no lo encuentra ninguna herramienta.
