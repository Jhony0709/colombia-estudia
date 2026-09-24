# 03 — Layout y componentes (contrato)

Qué forma tiene una pantalla y qué se usa para construirla. Lo que **no** está aquí:
los valores de color, espacio y radio (`tokens.md`), las obligaciones WCAG
(`accesibilidad.md`), el mapa y la voz (`DESIGN.md`) y los principios de producto
(`plan/11-ux.md`). Esto es la capa de en medio: la que hoy no estaba escrita y por eso
cada pantalla la resolvía por su cuenta.

Las referencias externas se citan por lo que aportan, no como autoridad. Donde una práctica
de fuera choca con `plan/11-ux.md`, manda `plan/11-ux.md`: nuestro usuario es un adulto con
un celular de gama media y datos limitados, no un desarrollador con dos monitores.

---

## 1. La gramática de una pantalla

Tres niveles. No hay un cuarto.

```
SideNav            la navegación del área (columna en escritorio, cajón en móvil)
Page               columna centrada, el marco
├── PageHeader     dónde estoy, qué es esto, la acción principal
├── PageSection    un h2 y su contenido
│   └── Card       un panel con nombre, dentro de la sección
└── PageSection
```

`components/templates/page` ya implementa los tres. **Una pantalla de staff que escribe su
propio `<section>` con un `<h2>` a mano está saltándose el contrato**, y eso es hoy la deuda
principal (§8).

### PageHeader

| Ranura        | Regla                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `back`        | Una sola ruta hacia arriba. No migas de pan de tres niveles: no tenemos tres.                                                            |
| `overline`    | Dónde está esto en el producto. Opcional.                                                                                                |
| `title`       | El `h1`. Uno por pantalla. Recibe el foco al cambiar de ruta.                                                                            |
| `description` | Una o dos líneas de para qué sirve la pantalla. Opcional.                                                                                |
| `action`      | **Una** acción principal, o ninguna. Puede ir acompañada de una secundaria (`Vista previa` junto a `Publicar`); nunca de otra principal. |

La ranura única de acción es deliberada y ya está comentada en `Page.tsx:6-7`: _«una
cabecera que puede llevar cinco botones acaba llevando cinco botones»_. Es la misma regla
que GOV.UK llama _one thing per page_ y que Polaris fija con una sola `primaryAction` por
`Page`. Si hacen falta dos acciones, una de las dos pertenece a una sección.

**No copiamos** el saludo con emoji del panel de Tiptap: `plan/11-ux.md:18` prohíbe emojis
en la UI, y un «¡Bienvenido, Jhonny! 👋» no dice en qué pantalla estás.

### PageSection

Toda sección tiene `title`. Una sección sin nombre es un `div`, y además deja de ser
navegable por landmark (`PageSection` pone `aria-labelledby`). La acción de sección va en su
propia ranura, nunca en la cabecera de la página.

### Anchos

| Contenido                     | Ancho                                                  |
| ----------------------------- | ------------------------------------------------------ |
| El marco de la pantalla       | `max-w-5xl` (`Page`)                                   |
| Texto corrido que alguien lee | `max-w-reading` (68ch, `size.readingWidth`)            |
| Campos de formulario          | El de su columna; nunca un `input` de 1200 px de ancho |
| Tablas                        | Ancho completo, con scroll propio en su contenedor     |

---

## 2. Ritmo del espaciado

La escala es `space.{1,2,3,4,6,8,12}` y no se sale de ahí. Lo que faltaba no eran los
tokens sino **qué distancia significa qué**, que es lo que convierte una pantalla en algo
legible sin leerla:

| Distancia | Token      | Separa                                           |
| --------- | ---------- | ------------------------------------------------ |
| 4 px      | `space-1`  | Icono y su texto; etiqueta y su pista            |
| 8 px      | `space-2`  | Etiqueta y su campo; elementos de una misma fila |
| 12 px     | `space-3`  | Controles relacionados entre sí                  |
| 16 px     | `space-4`  | Elementos distintos dentro de un bloque          |
| 24 px     | `space-6`  | Bloques dentro de una sección                    |
| 32 px     | `space-8`  | Secciones (lo que aplica `PageSection`)          |
| 48 px     | `space-12` | Cambios de área                                  |

Regla derivada: **si dos cosas están más juntas que dos cosas que sí se relacionan, la
jerarquía está mintiendo.** Es proximidad de Gestalt, y es el error más común cuando alguien
ajusta un margen suelto para «que se vea bien».

---

## 2b. Densidad y dimensiones

Dos cosas distintas que se confunden. **Dimensiones**: lo ancho que es el marco.
**Densidad**: lo apretado que va lo de dentro.

| Token               | Valor | Qué es                                             |
| ------------------- | ----- | -------------------------------------------------- |
| `size.sidenavWidth` | 16rem | La columna de navegación del staff                 |
| `size.contentMax`   | 64rem | Lo ancho que llega el contenido, sin la navegación |
| `size.readingWidth` | 68ch  | Un párrafo que alguien lee                         |

La densidad se aplica poniendo `density-compact` o `density-comfortable` en un contenedor: las
variables cascadean y todo lo que dentro use `min-h-control`, `min-h-row` o `gap-density` cambia
con él. No hay variantes de componente.

| Escala        | Control | Fila  | Separación |
| ------------- | ------- | ----- | ---------- |
| `compact`     | 36 px   | 40 px | 8 px       |
| `default`     | 44 px   | 48 px | 12 px      |
| `comfortable` | 48 px   | 56 px | 16 px      |

**`compact` baja de `size.touchMin` a propósito, y por eso está limitado.** Solo se permite en
pantallas de staff en escritorio, donde el puntero es un ratón. Prohibido en el player, en el
intento, en la cartera y en cualquier cosa que se use con el dedo — ahí manda `plan/11-ux.md:20`
(se diseña a 360 px, una mano). Y nunca por debajo de 24 px, que es el mínimo de WCAG 2.2
SC 2.5.8 en nivel AA aunque haya ratón.

---

## 3. Superficies: cuándo se sube un nivel

Ya hay cinco y no habrá más (`tokens.md` §Superficies). Lo que hacía falta es la regla de
uso:

> Un nivel de superficie existe porque representa una **diferencia funcional**, no porque
> algo tenga que verse separado.

| Superficie       | Qué justifica usarla                                     |
| ---------------- | -------------------------------------------------------- |
| `surface.canvas` | El fondo de la pantalla                                  |
| `surface.base`   | Un panel de contenido, un formulario, el player          |
| `surface.sunken` | Un pozo: campo, barra de progreso, chip, fila en `hover` |
| `surface.raised` | Algo que flota sobre lo demás: menú, popover, diálogo    |
| `surface.note`   | Un `role="note"` del autor                               |

**Prohibido anidar `surface.base` dentro de `surface.base`.** Una tarjeta dentro de una
tarjeta dentro de una tarjeta no crea jerarquía, crea ruido; la jerarquía la dan el
encabezado y el espacio.

**El área de staff es lienzo, no papel.** `surface.canvas` es el fondo de todo —incluida la
barra lateral— y `surface.base` es lo que se despega de él. Hasta el 18/9 la barra lateral era
blanca y el contenido gris, que es lo contrario: la navegación es lo que menos tiene que
llamar la atención de la pantalla.

### Borde antes que sombra

`border.muted` agrupa; `border.default` delimita algo interactivo. **La sombra no agrupa**, y
la razón no ha cambiado: en oscuro una sombra no se ve, así que una tarjeta que agrupara con
sombra dejaría de agrupar en cuanto alguien cambia de tema.

Lo que cambió el 18/9 es que la tarjeta en reposo además lleva `elevation-resting`, una sombra
muy baja que en claro la despega del lienzo y en oscuro no se nota. Es refuerzo, no mecanismo:
quitarla no rompe nada, quitar el borde sí. Esta línea decía antes que el panel de Tiptap usa
sombras y que era «un caso de no copiar lo que se ve»; Jhonny lo revisó y decidió adoptar el
relieve, conservando el borde como lo que agrupa.

| Token                | Dónde                                                    |
| -------------------- | -------------------------------------------------------- |
| `elevation-none`     | En el flujo y sin despegarse: campo, fila, barra lateral |
| `elevation-resting`  | Tarjeta en reposo sobre el lienzo                        |
| `elevation-floating` | Menú, popover, tooltip                                   |
| `elevation-modal`    | Diálogo, hoja                                            |

Cuatro y con nombre, no con número: un número no dice cuándo usarlo, así que quien escribe una
pantalla elige el que le parece y acaban existiendo cuatro alturas sin significado.
`elevation-none` sigue siendo el valor por defecto de todo lo que no sea una tarjeta.

---

### Sheet y PageHelp: la hoja y la ayuda de la pantalla

`Sheet` (`organisms/sheet`) es una hoja que entra por la derecha con `elevation-modal`: la
misma pieza de Radix que el cajón de navegación en móvil, en la otra dirección y para
CONTENIDO —una vista previa, una ayuda— sin salir de donde se estaba. `size="reading"` para lo
que se lee, `narrow` para listas.

`PageHelp` (`organisms/page-help`) es un botón fijo abajo a la derecha que abre una `Sheet` con
los temas de ayuda que declara la pantalla. Es el último elemento del DOM: con el tabulador se
llega a él después del contenido, que es donde uno pide ayuda. Sin temas, no hay botón. La
chuleta del formato del editor vivía plegada entre el texto y los minutos; una ayuda es algo
que se pide, no algo que se lee de paso.

### LogoutDialog: «Cerrar sesión» pregunta en el sitio (23/9)

`components/organisms/logout-dialog`. La misma pieza de Radix que `Sheet`, centrada, con
overlay oscurecido **y desenfocado** (`bg-black/40 backdrop-blur-sm`): lo de detrás se ve que
está, pero no compite con la pregunta. Confirmar es un `<form method="POST">` a
`/api/auth/logout`, nunca GET. `LogoutButton` es el `<button>` que lo abre y es el único
«Cerrar sesión» de la navegación (`SideNav`, `StudentTopNav`, cabecera del aliado): no es un
`NavItem` porque ya no lleva a ningún sitio (§5). Desde un menú Radix se abre **diferido**
(`setTimeout(…, 0)`) o el menú se queda abierto detrás. `/auth/logout` sigue existiendo para
quien llegue por URL. Motion: `.dialog-overlay` / `.dialog-panel` (`globals.css`) por
`data-state` de Radix, entrada grow + salida fade con los tokens de `duration`/`easing`; son
las clases que debe usar cualquier diálogo centrado nuevo.

### Toast: el aviso que se va solo, salvo el error (24/9)

`components/organisms/toaster` (`ToastProvider` en el layout raíz, `useToast()` en cualquier
cliente). Para el resultado de una acción (guardado, publicado, no se pudo) y para avisos
de validación que cambian: una gravedad por toast, la palabra en `sr-only`, éxito e
información se van a los 6 s, el error se cierra. Una acción como mucho («Ver los avisos»),
y lo que necesite más de una frase va a una hoja, no al toast. No es para lo que el usuario
tiene que leer antes de seguir (eso es `Alert` en línea o un diálogo).

### Tooltip: el nombre de un botón de icono, a la vista

`Tooltip` (`atoms/tooltip`) envuelve un botón que solo enseña un icono y muestra su nombre al
pasar por encima o al enfocarlo con el teclado. **No sustituye al nombre accesible: lo
enseña.** El botón sigue llevando su texto en `sr-only`; el tooltip es `aria-hidden` para que
el lector de pantalla no diga el nombre dos veces. No se abre al tocar: en un teléfono un
tooltip que aparece al pulsar tapa lo que se acaba de pulsar. Todo botón de icono lo lleva,
**con dos excepciones (19/9)**: el botón de cerrar de un diálogo o una hoja (`Sheet`, el cajón
de `SideNav`) y el botón que abre el cajón del teléfono. El cierre es lo primero que Radix
enfoca al abrir, y un tooltip que se abre con el foco aparecería solo y se comería el primer
`Escape` (su capa queda por encima de la del diálogo); el botón del teléfono vive donde no hay
hover. En los dos, el nombre `sr-only` es el nombre, y la X y el menú hamburguesa se entienden
sin más.

### Badge: la píldora de estado

Un estado —«Borrador», «Publicado», «Sin publicar»— en forma de píldora. **La palabra es el
estado y el color es refuerzo**, que es la misma regla que obliga a poner el contador de avisos
en texto y no en un punto rojo (`plan/11-ux.md:79`): quien no distingue el azul del gris, y
quien escucha la página en vez de verla, tiene que recibir «Borrador» igual de claro. Por eso
no hay una variante que sea solo color y `children` es texto, nunca un icono suelto.

Cinco variantes —`neutral`, `info`, `success`, `warning`, `error`— y las cinco con su par de
contraste en el contrato (`design-tokens/src/contract/pairs.ts`), no solo medido una vez.

**StatusBadge (23/9, ola 2)**: para el estado de una entidad del dominio —cohorte,
matrícula, cuenta, cuota, acuerdo, entrega, avance de un tema, intento— no se arma el
`Badge` en la pantalla: `<StatusBadge domain="cohort" status={cohort.status} />`
(`components/molecules/status-badge`). Un dominio decide una vez su tabla de tonos y sus
textos (`status.<dominio>.<ESTADO>` en `messages/`), así «Abierta» es verde en la lista, en
la cabecera y en la ficha. `Badge` a secas queda para juicios de una pantalla (aprobado o
no, confirmado o no, con subtítulos o sin ellos).

---

### DataTable con filas expandibles (24/9)

`DataTable.expandable = { isExpanded, onToggle, content, label }`. Es el patrón de
`TableExtended` de Basikon: una primera columna estrecha con un chevron (`aria-expanded`,
`aria-controls`) y, al abrir, una fila hija a todo lo ancho con lo que cuelga de esa fila
—una subtabla `plain compactRows`, un formulario—. El estado lo lleva quien usa la tabla.
Con `align="middle"` cuando la fila lleva chevron, botones o menú (por defecto `top`).
Para una lista cuyas filas tienen hijos que se consultan de vez en cuando (programas →
módulos); si los hijos se leen siempre, es una tabla agrupada, no una expandible. Primer uso:
`/contenido/programas`.

## 4. Filas o tarjetas

| Lo que enseñas                                                  | Forma     |
| --------------------------------------------------------------- | --------- |
| Una lista de lo mismo (personas, temas, cohortes, invitaciones) | **Filas** |
| Entidades visualmente independientes, pocas y heterogéneas      | Tarjetas  |

Una lista de tarjetas obliga a leer cada una entera para comparar dos. Una lista de filas
alinea el dato en la misma columna y se compara de un vistazo. Es la razón por la que Carbon
y Polaris resuelven los índices con tablas y no con rejillas de tarjetas.

Para filas usamos `components/molecules/data-table`. Una fila presionable es **un solo
botón** para el lector de pantalla, no siete elementos enfocables (`DESIGN.md` §Patrones).

---

## 5. Navegación no es acción

Regla estricta, aunque en pantalla se parezcan:

| Componente     | Para                                   | Elemento       |
| -------------- | -------------------------------------- | -------------- |
| `NavItem`      | Ir a otro sitio                        | `<a>`          |
| `Button`       | Hacer algo aquí                        | `<button>`     |
| `ToggleButton` | Encender/apagar un estado              | `aria-pressed` |
| `MenuItem`     | Una acción dentro de un menú           | APG _menu_     |
| `Tabs`         | Cambiar de vista sin cambiar de página | APG _tabs_     |

Un `<div onClick>` no es ninguno de los cinco. Si navega, es un enlace: tiene que poder
abrirse en otra pestaña.

**`hover` nunca significa seleccionado.** Son dos estados distintos y necesitan dos
tratamientos distintos; confundirlos deja al usuario sin saber qué está activo cuando aparta
el ratón — y sin ninguna información en teclado, donde no hay `hover`.

### El orden de la barra lateral (19/9)

Cuatro grupos, en el orden en que se construye un curso, porque es el que impone el modelo:

| Grupo            | Destinos               | Por qué va ahí                                                          |
| ---------------- | ---------------------- | ----------------------------------------------------------------------- |
| Plan de estudios | Asignaturas, Programas | `Lesson.subjectId` y `moduleId` son obligatorios: sin esto no hay tema  |
| Contenido        | Temas, Evaluaciones    | Se escriben y **se publican** dentro de un módulo                       |
| Operación        | Cohortes, Personas     | `openCohort` exige todo publicado; la cohorte existe antes que su gente |
| Administración   | Institución            | Configuración, al final                                                 |

Hasta el 19/9 mandaba «el trabajo diario primero» (Personas y Cohortes arriba). Se cambió
porque los siete destinos se ven a la vez —bajar dos grupos no cuesta nada— y leer la barra
de arriba abajo explica el modelo sin abrir la ayuda. SSOT del orden: `lib/nav/staff-nav.ts`;
los rótulos de grupo, en `SideNav` (`SECTIONS`).

### Navegación bloqueada

Lo que no está disponible por capacidad se muestra **en su sitio, en gris, con candado y con
la razón**, no se esconde. Ya tenemos el token (`status.locked`) y la regla de copy
(`DESIGN.md` §Voz: «Se habilita al completar…», no «bloqueado»). Esconder una opción hace
que el usuario crea que no existe y pregunte por ella a soporte.

---

## 6. Contrato de estados

### De un control (los siete, ninguno opcional)

`default` · `hover` · `pressed` · `focus-visible` · `selected` · `disabled` · `loading`

- **`focus-visible`, nunca `focus`.** El anillo es `focus.ring`, **3 px con 3 px de
  separación** —el valor que ya aplica la regla global `:focus-visible` del plugin, no uno
  nuevo— y se pone con el token, jamás con `outline: blue`.
- El anillo tiene que cumplir 3:1 contra lo que tenga detrás (WCAG 2.2 SC 1.4.11) y no puede
  quedar tapado por una barra fija (SC 2.4.11).
- **`disabled` siempre va acompañado del motivo.** Un botón apagado sin explicación es un
  callejón; el motivo va al lado, no en un `title`.
- `loading` bloquea la doble pulsación y lo anuncia; no basta con cambiar el color.

Material llama a esto _state layers_ y Primer lo exige por componente. Para nosotros es más
simple: un control al que le falta un estado es un control sin terminar.

### Tamaño mínimo del objetivo

44 × 44 px (`size.touchMin`), **en toda la aplicación y no solo en el player**. WCAG 2.2 pide
24 × 24 en AA (SC 2.5.8) y 44 × 44 en AAA (SC 2.5.5); Apple pide 44 y Material 48. Nos
quedamos en 44 porque `plan/11-ux.md:20` dice que se diseña para un celular sostenido con una
mano.

Cuando el control visible es más pequeño (un radio de 20 px, una casilla), **el área
presionable se agranda envolviéndolo en su `<label>`**, no agrandando el dibujo.

### De una pantalla que carga datos

Los cinco de `plan/11-ux.md` §Sistema de estados: cargando (skeleton con la forma del
contenido, por sección), vacío, con datos, error, sin permiso. Ninguna pantalla en blanco,
nunca.

---

## 7. Divulgación progresiva

> Acciones frecuentes, visibles. Acciones ocasionales, bajo un `⋯`. Acciones destructivas,
> nunca dominantes.

Siete botones permanentes en cada fila hacen que ninguno se vea. Lo destructivo se marca con
`status.error` en el **texto y el icono**, no pintando un bloque rojo: el rojo señala, no
grita. Y todo lo irreversible pasa antes por una confirmación con resumen
(`plan/11-ux.md:15`), que es la regla que ya sostiene «anular en vez de borrar».

El patrón de menú es el de APG (_menu button_): abre con `Enter`/`Espacio`/flecha abajo,
cierra con `Escape`, devuelve el foco al disparador.

---

## 8. Ciclo de vida de un componente

Tomado de Primer, que lo resuelve bien: un componente tiene estado declarado y el estado
manda sobre el gusto.

| Estado     | Significa                                                                 |
| ---------- | ------------------------------------------------------------------------- |
| `borrador` | Vive dentro de una pantalla. No se importa desde otra.                    |
| `estable`  | Está en `components/`, con story, test y paso de teclado. Se usa siempre. |
| `retirado` | Ya no se usa en pantallas nuevas. **No se borra** (`DESIGN.md` §Proceso). |

Un patrón se promueve a `estable` **al tercer uso**, no al segundo: dos usos pueden
parecerse por casualidad.

### Inventario hoy

| Componente                         | Estado                                            |
| ---------------------------------- | ------------------------------------------------- |
| `atoms/button`                     | estable                                           |
| `atoms/input`, `label`             | estable                                           |
| `atoms/form-field`                 | estable                                           |
| `atoms/alert`                      | estable                                           |
| `atoms/password-input`             | estable                                           |
| `molecules/data-table`             | estable                                           |
| `molecules/empty-state`            | estable                                           |
| `organisms/app-header`             | estable                                           |
| `templates/page`                   | estable                                           |
| `atoms/card`                       | estable                                           |
| `atoms/nav-item`                   | estable                                           |
| `organisms/side-nav`               | estable                                           |
| `organisms/app-header`             | **retirado** el 18/9 (ver `PRODUCT_DECISIONS.md`) |
| `ToggleButton`, `MenuItem`, `Tabs` | **no existen** (§5 los exige)                     |

---

## 9. Reglas no negociables

1. Ningún componente consume un color literal. Solo tokens semánticos.
2. El espaciado sale de la escala. Un valor suelto es un error, no un ajuste.
3. Cinco superficies. `surface.base` no se anida dentro de `surface.base`.
4. Borde para agrupar; sombra solo para lo que flota.
5. El acento se reserva para acción principal, foco, activo y enlace. No decora.
6. `hover` ≠ `selected`.
7. Todo control interactivo tiene los siete estados y `focus-visible` con token.
8. 44 px de objetivo presionable, en toda la aplicación.
9. Listas de lo mismo: filas, no tarjetas.
10. Una `PageHeader` con una sola acción principal, igual en todas las pantallas.
11. Navegar y actuar no comparten componente.
12. Lo bloqueado se muestra con su razón; no se esconde.
13. Ninguna pantalla en blanco.
14. La jerarquía la dan encabezado, espacio y tipografía. **Si quitas todo el color, la
    pantalla tiene que seguir entendiéndose.**
15. Sin emojis en la UI. **Una excepción, decidida el 18/9**: el saludo de bienvenida de una
    pantalla de inicio. Solo ahí, un emoji, y nunca en un estado, una etiqueta, un aviso ni una
    notificación — donde el emoji sustituiría a una palabra que un lector de pantalla necesita.
    Escrita aquí para que `ui-craft` AP11 no la persiga y para que nadie la amplíe por analogía.

---

## 10. Deuda actual contra este contrato

Comprobado leyendo el código, no de memoria.

**Saldado el 18/9**: las siete secciones a mano pasaron a `PageSection`; `elevation` es
semántica; existen `Card`, `NavItem`, `SideNav` y `Menu`; y las acciones de una pregunta
dejaron de estar permanentemente a la vista.

Queda:

| Dónde                                        | Qué incumple                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Toda la aplicación                           | No existen `ToggleButton` ni `Tabs` (§5)                                                                                             |
| `lesson-browser.tsx`, `programs-manager.tsx` | Tarjetas escritas a mano (`bg-surface-base border … rounded-card`) en vez de `Card` (§3): `details` y `article` no caben en el átomo |

El editor de un tema (`lesson-editor.tsx`, `lesson-media.tsx`, `lesson-details-form.tsx`)
salió de esta lista el 19/9: cada bloque es una `Card` y los medios son filas de una tarjeta.
El área de escribir es `features/content/editor/BlockEditor.tsx`: un `role="group"` con un
`<ol>` de bloques, cada uno una `<section>` con nombre («Bloque 3: Texto») y un campo nativo
dentro; sus botones —subir, bajar, añadir, quitar— llevan el número del bloque en el nombre.

La única excepción declarada al §1 sigue siendo la tarjeta del texto: su encabezado es el
`<label>` del `textarea`, y convertirlo en un `h2` rompería la asociación entre la etiqueta y
el campo. Por eso `Card` tiene `labelledBy`: la tarjeta es una región con el nombre que ya
pone el `label`, sin duplicarlo.

## 10b. Dónde se prueba una interacción

jsdom no sabe observar un primitivo **posicionado** (Popper/floating-ui: `DropdownMenu`,
`Select`, `Tooltip`, `Popover`). Medido el 18/9 con `Menu`: cinco pruebas agotaban su tiempo y
la suite tardaba 147 segundos, con el componente sano; añadir `ResizeObserver` y `DOMRect` al
entorno no cambió nada. Un primitivo que **no** se posiciona, como `Dialog`, sí funciona: los
tests de `SideNav` pasan en jest. Corolario medido el 19/9: un `Tooltip` sobre el botón de
cerrar de un `Dialog` convierte al diálogo en un primitivo posicionado en cuanto se abre,
porque el foco automático abre el tooltip; tres pruebas del cajón de `SideNav` pasaron de
verde a agotar el tiempo solo por eso.

| Qué se prueba                                              | Dónde                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Nombre accesible, estado inicial, clases de estado         | jest (`*.test.tsx`)                                      |
| Teclado, foco, panel en portal, componente **posicionado** | función `play` de la story, con `@storybook/test-runner` |

La regla, para no discutirla componente a componente: **si la prueba necesita que algo esté
colocado en la pantalla, va en la story.** Y una prueba que tarda treinta segundos en decir la
verdad es peor que ninguna, porque además se acaba desactivando.

**Pendiente**: `test-storybook` no está en la raíz ni en CI, así que hoy esas pruebas solo
corren si alguien las lanza a mano.

---

## 11. Cómo se hace cumplir

| Regla                               | Hoy                                                |
| ----------------------------------- | -------------------------------------------------- |
| Contraste de los pares              | `design-tokens/src/contrast.test.ts` — bloqueante  |
| Teclado y a11y por componente       | Story con addon-a11y + paso manual (`DESIGN.md`)   |
| Tokens y no literales               | Barrido `/audit-ui` antes de cerrar trabajo visual |
| Arquitectura de importaciones       | `lint:arch` (dependency-cruiser)                   |
| **Uso de `PageSection`**            | **Nada lo comprueba.** Regla de eslint pendiente   |
| **Los siete estados de un control** | **Nada lo comprueba.** Revisión manual             |

Las dos últimas filas son el motivo real de la deuda de §10: lo que no tiene guardia, se
incumple. AMBIGUO: falta decidir si la regla de `PageSection` se escribe como lint o se deja
en revisión.
