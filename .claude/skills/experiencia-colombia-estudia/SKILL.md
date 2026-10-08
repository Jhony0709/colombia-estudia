---
name: experiencia-colombia-estudia
description: Experiencia dinámica de lo que ve el estudiante en Colombia Estudia (ALBA): principios destilados de Lemonade, el mapa de motion por pantalla, el formulario conversacional y sus primitivas. Usar ANTES de diseñar, construir o animar una pantalla del estudiante o del acudiente, el acceso, el registro o cualquier flujo de preguntas de varios pasos.
---

# Experiencia Colombia Estudia

**Precedencia**: `reference/03-ui/tokens.md`, `reference/03-ui/accesibilidad.md` y
`motion-colombia-estudia` ganan sobre esta skill; esta skill gana sobre cualquier referencia
externa. `motion-colombia-estudia` dice **qué vocabulario y qué tokens** están permitidos;
esta dice **qué hace cada pantalla y en qué orden**. La portada pública (`features/marketing`)
tiene su propio sistema (`--mo-*`, `site.css`) y queda fuera.

**Procedencia**: análisis de lemonade.com y `chat.lemonade.com` del 6/10, medido en el DOM
(doc del proyecto `claude/colombia-estudia-lemonade-ux-0610.md`). Se tomó el criterio, no
la marca: sus valores se traducen a nuestros tokens.

## 1. Principios

- **P1 — El contenido no espera al motion.** Lo que se lee está en el primer frame o empieza a
  entrar antes de 600 ms (el último elemento de la coreografía arranca antes de eso). Nada
  bloquea escribir ni pulsar.
- **P2 — Una cosa nueva a la vez.** Orden narrativo: contexto → lo principal → la acción. Lo
  que entra junto entra en escalera, nunca todo de golpe ni todo por separado.
- **P3 — La vida está en la respuesta a la acción.** El feedback de elegir, marcar o enviar es
  inmediato (`duration.fast`). El acento de marca significa «esto es tuyo» o «estás aquí».
- **P4 — La orientación se aparta.** El avance (paso, sección, barra) se ve mientras se
  actúa y se atenúa cuando la persona relee lo anterior.
- **P5 — Lo hecho queda a la vista y se edita en su sitio.** Nada de «Atrás» como única vía.
- **P6 — El sistema habla breve.** Acuses de una línea que enlazan con la respuesta anterior;
  sin emojis ni exclamaciones (doctrina de UI). Lo que ya se sabe no se pregunta: se muestra
  inferido y editable.
- **P7 — Un solo momento por pantalla, ligado a un dato.** La nota, el avance, la constancia.
  `duration.slow` sigue reservado a la celebración del programa completado, una vez; excepción
  (Jhonny, 8/10): el amanecer del cuestionario aprobado y la respiración del no aprobado
  (`duration.breath`, una sola, bajo 5 s), en `ResultMoment`.
- **P8 — Lo repetido no se anima** (frontend §2 M2): avanzar preguntas del intento, recorrer
  listas con teclado, abrir el mismo menú por décima vez.
- **P9 — Movimiento reducido = corte**, venga del sistema operativo **o** de la preferencia
  de la plataforma (`ce-motion`, §5).

## 2. Vocabulario que esta skill añade

Se suma al de `motion-colombia-estudia` y con sus mismas reglas (solo `opacity`/`transform`,
tokens, interrumpible, salida más simple que la entrada).

| Término      | Qué es                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **entrada**  | `opacity 0→1` + `translateY(motion.distance.sm → 0)`, `duration.normal`, `easing.enter`. No es «deslizar»: son 4 px, no un panel. |
| **escalera** | Entradas sucesivas separadas por `duration.stagger`. Máximo 6; del séptimo en adelante entran con el sexto.                       |
| **tecleo**   | La pregunta del formulario conversacional se escribe sola (§4). Nunca en texto de lectura.                                        |
| **eco**      | La zona de respuesta sale con fade (`easing.exit`) y la respuesta reaparece como píldora en el historial (fade, `fast`).          |
| **conteo**   | Un número sube hasta su valor (`normal`, una vez). El valor final está en el DOM desde el principio para el lector de pantalla.   |
| **apagado**  | Opacidad ligada al scroll (P4). Sin `transition`: la sigue el scroll, y con movimiento reducido no se aplica.                     |

## 3. Tokens que hace falta añadir al contrato

Aprobados por Jhonny y añadidos el 6/10 en `packages/design-tokens` (`tailwind-plugin.ts`,
`contract/semantic-tokens.ts`) y `reference/03-ui/tokens.md`. Tailwind: `duration-stagger`.

| Token                | Valor     | Uso                                                           |
| -------------------- | --------- | ------------------------------------------------------------- |
| `duration.stagger`   | `60ms`    | Separación de la escalera.                                    |
| `duration.typeChar`  | `8ms`     | Un carácter del tecleo (≈ 120 car/s; Lemonade mide ≈ 145).    |
| `motion.distance.sm` | `0.25rem` | La entrada. Ya existe como literal en `question-fade-in`.     |
| `motion.distance.md` | `0.5rem`  | La entrada de un bloque grande (héroe, tarjeta de resultado). |

## 4. Formulario conversacional

Para el registro y cualquier flujo de 4+ preguntas dirigido al estudiante. No para staff: allí
un formulario denso es más rápido.

**Estructura**

- Pasos declarativos: `{ id, section, prompt(answers), field, validate, skipIf?, infer? }`.
  `prompt` recibe las respuestas para el acuse («Gracias, Ana. ¿A qué correo te escribimos?»).
- **Un solo `<form>` y un solo envío al final.** Nada se guarda en el servidor por paso; el
  borrador vive en memoria (sin la contraseña). Un error del servidor devuelve a la pregunta
  que lo causó.
- **Historial**: lo respondido queda arriba como píldora con «Editar», que reabre esa pregunta y
  vuelve al siguiente paso pendiente al confirmar. La contraseña se repite como «••••••••». A
  pantalla completa, el historial es un contenedor `flex-direction: column-reverse` con scroll
  propio; dentro de una columna (`AuthShell`) no lo tiene y la página baja a la pregunta nueva
  (`scrollIntoView` `nearest`).
- **Coreografía de un paso** (`motion/react`, tokens vía `useMotionTokens`): la pregunta y su
  respuesta salen con fade (`fast`, `easing.exit`); al terminar, la píldora entra en el
  historial (eco: `normal`, sube `distance.sm`) y la pregunta nueva entra igual y se teclea;
  sus campos y botones entran en escalera al acabar el tecleo (`.convo-answer`, CSS). El
  historial se recoloca con `layout`. Medido el 6/10: salida 0–170 ms, eco y pregunta
  180–500 ms, campos +60 ms entre sí.
- **Implementación**: `components/organisms/conversational-form` (pasos por `id`, así que una
  respuesta que quita o añade pasos no rompe el recorrido). Primer uso: `/registro`.
- **Secciones**: stepper a la izquierda desde `lg` con **apagado** según el scroll del
  historial; en el teléfono, una línea «Paso 2 de 4 · Contacto» con barra.
- **Respuestas**: opciones como botones que responden al pulsar (sin «Continuar»); texto solo
  cuando hace falta, con etiqueta flotante (`fast`) y el `autocomplete` correcto
  (`given-name`, `family-name`, `email`, `tel`, `bday`, `new-password`). Enter avanza.

**Tecleo accesible** (Lemonade lo hace mal: oculta la frase entera al lector)

- La frase completa en `sr-only`, con `tabIndex={-1}`; recibe el foco y se anuncia.
- La capa que se escribe va `aria-hidden`, encima de un fantasma `visibility:hidden` con la
  frase entera que reserva el alto: cero saltos de layout.
- Pausa `duration.fast`, luego `duration.typeChar` por carácter con `requestAnimationFrame`;
  la zona de respuesta entra (**entrada**) `duration.fast` después de terminar.
- La respuesta espera al tecleo (oculta y sin puntero, ≤ 0,6 s) y al aparecer recibe el foco;
  su grupo se llama con la pregunta, así que el lector la anuncia al entrar. **Cualquier tecla
  durante el tecleo lo termina al instante**: escribir nunca espera a la animación.
- Sin tecleo al volver con «Editar», con movimiento reducido o con la pestaña oculta.

## 5. Primitivas

Viven en `apps/web/components/atoms/motion/` (`InView`, `CountUp`, `TypedPrompt`), `lib/motion/`
(`preference.ts`, `use-motion-reduced.ts`, `tokens.ts`) y `globals.css` (clases `.motion-*`). Son
las únicas que se usan para esto.

- **Movimiento reducido de la plataforma** (hecho el 6/10): cookie `ce-motion`
  (`lib/motion/preference.ts`) que el layout raíz convierte en `html[data-motion="reduced"]`;
  `globals.css` aplica bajo ese atributo la misma regla de corte que `prefers-reduced-motion`.
  Se elige en «Cómo leer» del tema. En JS: `motionReduced()` (preference.ts) y, para
  `motion/react`, `useMotionReduced()` (`lib/motion/use-motion-reduced.ts`); nunca
  `useReducedMotion` a secas, que solo mira el sistema.
- **Entrada y escalera en CSS**, no en JS: `.motion-enter` (`sm`), `.motion-enter-md`,
  `.motion-stagger` (cada hijo +1 `stagger`, tope en el sexto) y `.motion-order-1..3` (cada paso
  del orden de la pantalla son 2 `stagger`).
  Sin estilo en línea (la CSP con `nonce` bloquea los atributos `style`), SSR sin parpadeo y
  la regla global de movimiento reducido las corta sola.
- **En vista**: solo para bloques bajo el pliegue. Patrón de la portada: el CSS solo oculta
  bajo `[data-motion-ready]`, que pone un cliente pequeño al hidratar. Sin JS no se oculta nada.
- **`<CountUp value>`**: cliente; el valor final en un `sr-only`, lo animado `aria-hidden`.
- **`<TypedPrompt>`** y el organismo **`ConversationalForm`**: §4.

## 6. Mapa por pantalla

Lo que no aparece en la columna «Se anima» va con corte. El texto de lectura nunca se anima.

| Pantalla                       | Se anima (en este orden)                                                                                         | Momento (P7)                                               | Nunca                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `/aprender` (panel)            | héroe: entrada `md` → KPIs: escalera → tarjetas de abajo: entrada en vista                                       | barra del héroe crece al cargar (`ProgressBar grow`)       | saludo, fecha, ruta                               |
| Catálogo (`/aprender`, 8/10)   | nada al filtrar ni al ordenar (P8); el carrusel se desliza con `scroll-behavior` (corte con movimiento reducido) | —                                                          | las tarjetas al cambiar de filtro                 |
| Panel terminado                | héroe → «Cursos abiertos»: escalera → «Cursos completados»: escalera                                             | check de la tarjeta recién completada                      | —                                                 |
| Panel sin matrícula            | curso destacado: entrada `md` → «Más cursos»: escalera; aside: entrada `order-1`                                 | inscribirse lleva directo al primer tema                   | saludo                                            |
| Panel del primer día           | héroe: entrada `md` → ruta y «Cómo funciona»: entrada `order-1`                                                  | —                                                          | sin KPIs ni barra al 0 %                          |
| Tema (`/aprender/tema`)        | nada al entrar; al completarse, el pie cambia por crossfade y el check entra `fast`                              | completar el tema                                          | el texto, el índice, la cuenta atrás (dígitos)    |
| Examen (antes de empezar)      | bloque de condiciones: entrada                                                                                   | —                                                          | —                                                 |
| Intento                        | cambio de pregunta: crossfade (ya existe); índice: estado `fast`                                                 | —                                                          | opciones en escalera (P8), el reloj               |
| Resultado del intento          | momento (`ResultMoment`): amanecer al aprobar, respiración al no aprobar → nota: conteo → cierre: entrada        | aprobar (8/10, Jhonny): amanecer; sin rojo al perder       | la revisión de preguntas, la respiración en bucle |
| Resultados                     | barras: `chart-grow` (ya existe) en vista, una vez                                                               | —                                                          | la tabla                                          |
| Constancias                    | tarjetas: escalera                                                                                               | la recién emitida: celebración `slow`, una vez (pendiente) | —                                                 |
| Notificaciones (menú y página) | menú: grow (Dropdown); punto de nuevo: fade `fast` al marcar leído                                               | —                                                          | la lista                                          |
| Calendario, biblioteca, cuenta | un solo bloque: entrada                                                                                          | —                                                          | listas y tablas                                   |
| Acceso (`AuthShell`)           | panel de foto: entrada `md`; formulario: corte                                                                   | —                                                          | los campos                                        |
| Registro                       | formulario conversacional (§4)                                                                                   | la pantalla final con la matrícula                         | —                                                 |
| Familia                        | como el panel                                                                                                    | —                                                          | —                                                 |

## Checklist

- [ ] ¿La pantalla está en el mapa (§6)? Si no, se añade aquí antes de construirla.
- [ ] ¿Lo que se lee está en el primer frame, y la coreografía completa termina en < 600 ms?
- [ ] ¿Solo vocabulario de §2 y de `motion-colombia-estudia`, y solo tokens?
- [ ] ¿Escalera de 6 como máximo, y nada repetido por teclado animado?
- [ ] ¿Movimiento reducido corta todo, tanto el del sistema como el de la preferencia?
- [ ] ¿Sin JavaScript o con la pestaña oculta, todo se ve?
- [ ] ¿Tecleo con la frase completa para el lector y el campo usable desde el primer frame?
- [ ] ¿Ni un atributo `style` en el HTML del servidor (CSP)?

## Estado de aplicación (6/10)

Hecho: panel (héroe `motion-enter-md` → KPIs `motion-stagger motion-order-1` → bloques
`motion-order-2` → ruta y catálogo con `InView`), panel terminado, tema (`EnterOnChange` en el
pie), resultado del intento (`CountUp` + insignia y cierre en orden), constancias y familia
(escalera), examen, calendario, biblioteca, cuenta y resultados (`<Page enter>`), acceso
(panel de foto `motion-enter-md`), registro (§4), panel sin matrícula y del primer día (6/10,
tras la crítica del primer día). Pendiente: la celebración de la constancia
recién emitida y el «apagado» del stepper (no hay stepper lateral aún: el registro va en columna).
