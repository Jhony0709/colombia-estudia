# Colombia Estudia — Brief de UI/UX del área del estudiante (23/9/2026)

Para un especialista en UI/UX que no ha visto el producto. Es el mismo ejercicio que
`brief-ui-ux-2309.md`, ahora **solo el estudiante**, con lo que existe hoy después de las
tres olas del 23/9 (`decision-ux-2309.md`). Todo lo que se afirma sale del código y de
`reference/`; lo que es opinión, se dice. Las pantallas se recorrieron con una sesión real
de estudiante (Estudiante Uno) en Chrome el 23/9; lo que no se pudo ver se marca.

Lo que **no** se negocia:

1. **La mora nunca toca el acceso académico de un menor** (`acceso-y-cartera.md` §2). En
   `/aprender/mi-cuenta` el texto lo dice: «Tu acceso a las clases no depende de esto».
2. **WCAG 2.2 AA es una puerta de CI** (`pa11y-ci`). Nada de color como único portador de
   estado, objetivos de 44 px, foco visible, `role="timer"` con hitos anunciados.
3. **Ningún diagnóstico de salud en la base de datos.** Los ajustes (más tiempo en un
   examen) se aplican sin decir por qué.
4. Datos personales bajo Ley 1581: nada personal en una URL; el consentimiento del menor lo
   firma su acudiente en papel.

---

## 1. Para quién y en qué condiciones

Adultos que terminan el bachillerato **de noche, en un celular de gama media, con datos
limitados**, a veces con lector de pantalla; menores con acudiente; gente que vuelve a
estudiar después de años y a la que un examen le da miedo. Se diseña a 360 px y se comprueba
a 320; el escritorio es el caso secundario (`plan/11-ux.md`).

Principios en vigor: una acción principal por pantalla; nunca una pantalla en blanco; nada se
pierde (autosave, cola local, «anular» en vez de borrar); el sistema dice la verdad (progreso
con número, tiempos del servidor); copy en segunda persona, sin jerga, **sin emojis y sin
exclamaciones**; una sola forma de completar cada cosa y el sistema dice cuál.

---

## 2. Qué cambió desde el primer brief (para no auditar lo viejo)

- **Ola 1** (`docs/estado.md` «Ola 1»): `/aprender` con «Continúa donde quedaste» /
  «Empieza por aquí» arriba y las demás matrículas como lista compacta; player con cabecera
  compacta, menú «Opciones» (Cómo leer, Reportar un problema), transcripción plegada, bloque
  «Practica» y **barra fija al pie** con estado + una acción; banner sin conexión.
- **Ola 2/3**: conmutador de espacios en la marca (solo multi-rol); `StatusBadge` por
  dominio; `/familia` con «Requiere tu atención».
- **Acceso**: `/auth/*` y `/registro` con foto a la izquierda desde `lg`, banda sin caras en
  móvil, logo enlazado a la portada (`components/templates/auth-shell`).
- **Arreglos del 23/9 con sesión real**: un vídeo no completaba el tema (el player de Vimeo
  emite `playProgress`, no `timeupdate`); «Empieza por aquí» quedaba vacía cuando nada estaba
  habilitado; fechas de cohorte un día antes en Bogotá (`@db.Date`); «Mis programas» quedaba
  marcado en Resultados/Constancias/Mi cuenta; desajuste de hidratación en Notificaciones.

---

## 3. Sistema visual: lo que aplica al estudiante

Tokens y gramática en `brief-ui-ux-2309.md` §2–3 (no se repiten). Lo específico:

- **Contenedor**: `Page` a `max-w-content` (`--size-content-max`), padding 16 px en móvil y 24
  desde `sm`, `space-y-10` entre secciones (`components/templates/page/Page.tsx:31-41`).
- **Barra superior** (`components/organisms/student-top-nav`): marca (o conmutador de
  espacios) · pestañas «Mis programas · Calendario · Biblioteca» (scroll horizontal en móvil,
  pasan a segunda fila) · campana con contador en texto · menú de la persona con «Mi
  historial» (Resultados, Constancias, Mi cuenta, Mi familia), el tema (claro/oscuro/sistema)
  y «Cerrar sesión». Sticky, 1 nivel.
- **Player**: rejilla `lg:grid-cols-[18rem_minmax(0,1fr)] gap-8` (`route-rail.tsx:171`); el
  artículo a `max-w-reading` (68ch). El rail va debajo en móvil.
- **Barra fija** (`components/organisms/sticky-action-bar`): `sticky bottom-0`, estado en
  palabras a la izquierda, enlaces en texto al medio, una acción a la derecha.
- **Examen**: `lg:grid-cols-[minmax(0,1fr)_16rem]` con el índice de preguntas a la derecha
  (`AttemptPlayer.tsx:266,295`); en móvil una pregunta por pantalla con Anterior/Siguiente.
- **Estados**: `StatusBadge` (`status.enrollment|account|installment|submission|lesson|attempt`).
- **Fechas**: `next-intl` en `America/Bogota`; las fechas sin hora (`@db.Date`) se pintan en
  UTC para no perder un día.

---

## 4. Pantallas

Para cada una: propósito, layout, qué hace, estados, y dónde está en el código.

### 4.1 `/aprender` — Mis programas (`app/(student)/aprender/page.tsx`)

**Propósito**: decir qué toca hoy y dejar entrar con un toque.
**Layout** (de arriba abajo): `PageHeader` «Mis programas» + «Estás en N programas. Elige uno
para ver su ruta.» → **tarjeta de tarea** (`ContinueCard`, borde de acento, `space-y-4`,
p-5/p-6): overline programa · cohorte; título «Continúa donde quedaste» / «Empieza por aquí» /
puerta (por iniciar, vencido, completado, retirado, menor sin consentimiento); cuerpo (qué es
el primer tema y cómo se completa; o «Tu primer tema es “…”. Se habilita el {fecha}»); botón
«Empezar con “…”» / «Seguir con “…”» con la forma y minutos al lado; barra de avance SVG y «x
de y completados» → **«Tus otros programas»**: lista compacta de una fila por matrícula
(programa, código · cohorte, «x de y», «Ver su ruta») → **«La ruta de {programa}»**: módulos
→ ítems con icono de forma (vídeo, lectura, actividad, examen), «Vídeo · 5 min · Sin empezar
· Todavía no está disponible» / «Se habilita al completar “…”» (candado en lineal).
**Reglas**: la matrícula elegida va por `?matricula=`; con una sola, no hay lista; el ítem
por el que seguir es el primero empezado o el siguiente habilitado (`outline.ts#resumePoint`).
**Visto**: desktop, con 4 matrículas. **Debilidad**: cuatro matrículas de prueba hacen la
página larga; con la ruta debajo, el móvil exige scroll largo para llegar a la ruta.

### 4.2 `/aprender/tema/[assignmentId]` — Player (`tema/[assignmentId]/page.tsx`)

**Layout**: `PageHeader` con overline «1. Tus primeras rimas · Tema 1 de 2 · 5 min de
estudio», título, subrayado amarillo, acción «··· Opciones» → rail izquierdo «Ver toda la
ruta» + módulo actual con «1/2» y los ítems (activo con borde izquierdo, completado con
check, bloqueado con candado) → artículo (`.contenido`, Markdown saneado; vídeo Vimeo en
`figure.media-video`) → transcripción en `<details>` (si hay) → grabador de evidencia
(invisible; solo `sr-only`) → **«Practica»** (overline, borde superior, 48 px): instrucciones
del autor en Markdown + «Se entrega escribiendo la respuesta aquí / subiendo un archivo» →
«Tu actividad»: textarea o archivo (PDF/PNG/JPG ≤ 20 MB) y «Enviar actividad»; o estado:
**«Actividad en revisión»** (tarjeta azul: cuándo, «Ver lo que enviaste», «Corregir antes de
la revisión»), **«Devuelta»** (comentario del instructor + reenviar), **«Aprobada»** → barra
fija: «En curso. Se completa al ver el video casi hasta el final.» · «Volver a la ruta» ·
«Completa este tema para seguir con “…”» / «Siguiente: …» / «Enviar actividad».
**Opciones** → `Sheet` «Cómo leer» (tamaño Normal/Grande/Muy grande, espaciado, ancho,
«Transcripción siempre desplegada»; se guarda en el navegador) y `Sheet` «Reportar un
problema».
**Reglas**: se muestra la versión asignada a la cohorte, no la última publicada; un vídeo
completa al 90 % o al leer la transcripción; una lectura completa al llegar al final con
tiempo; una actividad completa cuando la aprueban; en lineal «Siguiente» se habilita al
completar. La entrega se puede reemplazar mientras nadie la revise.
**Visto**: vídeo (RAP-1) y actividad (envío y corrección). **Debilidades**: el vídeo de
prueba no tiene transcripción (no se vio plegada); el `POST` de la entrega tardó ~15 s en
el servidor de desarrollo y el botón solo dice «Enviando…» sin más; con el vídeo a ancho
completo en escritorio el rail queda alto y vacío por debajo.

### 4.3 `/aprender/examen/[assignmentId]` — Antes de empezar (`examen/[assignmentId]/page.tsx`)

**Layout**: cabecera con overline «1 - Lo primero en la cocina · Examen parcial», título,
instrucciones del autor como descripción → mismo rail izquierdo → tarjeta **«Antes de
empezar»** a dos columnas: texto que quita el miedo («se completa al entregarlo», «cada
respuesta se guarda sola», «solo puede haber un intento abierto») + botón «Empezar el
intento» / «Continuar el intento»; a la derecha tarjeta «Qué esperar» con Intentos («Te
quedan 0 de 1»), Tiempo («Sin límite» o minutos con el ajuste ya aplicado), Preguntas («2
preguntas · 2 puntos»), «Al terminar verás» (según `reviewPolicy`) → «Tus intentos» (fila
por intento: número, empezado el, `StatusBadge attempt`, «Continuar» / nota) → «Volver a la
ruta del programa».
**Visto**: desktop. **Debilidad vista**: «Te quedan 0 de 1» con un intento **en curso** es
confuso (el intento abierto cuenta como gastado); «Continuar el intento» tardó más de un
minuto en responder en el servidor de desarrollo y volvió a su estado sin mensaje: si el
servidor tarda, la pantalla no dice nada.

### 4.4 `/aprender/examen/[id]/intento/[attemptId]` — El intento (`components/organisms/attempt-player`)

**No se pudo abrir hoy** (el servidor de desarrollo no respondió a tiempo). Por código:
cabecera con «Pregunta 3 de 10» como `h2`; en móvil una pregunta por pantalla con
Anterior/Siguiente; en escritorio todas en columna con índice de preguntas a la derecha
(rejilla 6/8/5 columnas); controles nativos (radio, checkbox, textarea); autosave con cola
local y «guardado» en texto; cronómetro `role="timer" aria-live="off"` con hitos anunciados
y ocultable; «Entregar» abre un diálogo que lista las preguntas sin responder; al vencer el
plazo del servidor se entrega solo. Resultado según `reviewPolicy` (nada / solo nota / todo
tras calificar / todo tras la fecha).

### 4.5 `/aprender/resultados` (`resultados/page.tsx:66-224`)

Tres `PageSection` con `DataTable`: **Mis exámenes** (examen + programa · módulo, `StatusBadge`
(Empezado, Bloqueado…), vence, mejor nota), **Notas por asignatura** («escala de 0 a 100, del
mejor intento calificado»), **Intentos** (examen · cohorte · intento N, estado, nota,
entregado). Disponible con el acceso vencido. **Debilidad**: tres tablas de tres columnas
casi vacías para un estudiante nuevo; «Bloqueado» como estado de un examen no dice por qué.

### 4.6 `/aprender/mi-cuenta` (`mi-cuenta/page.tsx`)

Solo con `billing.read.own`. Cabecera «Mi cuenta» + «Tu acceso a las clases no depende de
esto» → una tarjeta por matrícula: título «IVY-2026-1 — Introducción…», `StatusBadge
account` («Con cuota vencida»), «Próxima cuota: la 1, $ 300.000, vence el 2026-09-18»,
«Pagado $ 100.000 de $ 300.000 · vencido $ 200.000», «Pagar en línea» (si Wompi) y «Datos
para transferencia» (`<details>` con el correo de soporte) → **Cuotas** (tabla: cuota, vence, monto, `StatusBadge
installment`) → **Pagos** (fecha, cuota, monto, medio, confirmado/sin confirmar) → acuerdo
de pago si existe. Vuelta del checkout con «pago en proceso».
**Debilidades**: fechas en ISO («2026-09-18») junto a fechas en palabras («19 de sept de
2026»); el importe vencido en rojo-texto sin decir qué pasa si no se paga (para el adulto,
sí hay consecuencia: `acceso-y-cartera.md`).

### 4.7 `/aprender/calendario` (`calendario/page.tsx`)

Lista «Próximamente» y «Pasado» de eventos de **todas** las cohortes: inicio y fin de
cohorte, fin de tu acceso, plazos de exámenes, sesiones en vivo con «Unirse» desde 15 min
antes. Fila: icono · tipo (caption) · código de cohorte · fecha en palabras. **Debilidad**: con
cuatro matrículas son ocho filas de «fin de…» seguidas, sin agrupar por mes ni por cohorte, y
sin nada que hacer en ellas.

### 4.8 `/aprender/biblioteca` (`biblioteca/page.tsx`)

Recursos (documentos, audios, grabaciones) por módulo de los temas ya habilitados; enlaces
firmados que caducan a los diez minutos (lo dice la descripción). **Visto**: vacío
(«Todavía no hay recursos»). Sin buscador ni filtro.

### 4.9 `/aprender/certificados` (`certificados/page.tsx`)

Constancias emitidas al completar un módulo o programa, con enlace público de verificación.
**Visto**: vacío, con explicación de cuándo aparecen.

### 4.10 `/aprender/notificaciones` (`components/organisms/notification-list`)

Cabecera «Notificaciones» + «No tienes avisos sin leer» → «Avisos recientes»: tarjeta por
aviso (título, fecha y hora, cuerpo, «Ver»). Tipos hoy: entrega aprobada/devuelta, pago
confirmado, tema reabierto por versión nueva, recordatorios de cuota, sesión en vivo.

### 4.11 Acceso: `/auth/login`, `/registro`, `/auth/recuperar`, `/invitacion/[token]`

`AuthShell`: foto con titular a la izquierda desde `lg` («Volver a estudiar sí es posible»),
formulario a la derecha con logo (80 px), título, campos, botón lleno y enlaces en texto
(Regístrate → Olvidaste → enlace por correo); en móvil banda de mesa sin caras arriba.
Contraseña primero (decisión 16/9); registro público con cohorte de introducción (Fase B);
invitación en tres pasos.

---

## 5. Flujos

1. **Primer ingreso** → `/registro` (o invitación) → `/aprender` con «Empieza por aquí» →
   primer tema → barra «Siguiente». El momento de mayor abandono; medido en `/inicio` (staff)
   como «empezaron a estudiar».
2. **Tema con vídeo** → ver (90 %) o leer transcripción → «Tema completado» → «Siguiente».
3. **Tema con actividad** → leer → Practica → enviar → «en revisión» (corregible) → aviso
   «aprobada» o «devuelta» (reenviar) → completado.
4. **Examen** → «Antes de empezar» → intento (autosave) → entregar (diálogo) → resultado según
   política → `/resultados`.
5. **Pagar** → `/mi-cuenta` → «Pagar en línea» (Wompi) → vuelta «en proceso» → aviso «Pago
   confirmado». Adulto en mora: restricción según política; menor: nunca.
6. **Volver a entrar** → `/auth/recuperar` → correo → `/auth/restablecer`.
7. **Sin conexión** → banner; la evidencia y la entrega reintentan al volver.

---

## 6. Reglas de negocio que condicionan el diseño

- El tema muestra la **versión asignada a la cohorte**; una versión nueva con «reabre» vuelve
  el tema a «Empezado» y avisa (`lesson_reopened`).
- Progresión **lineal**: el siguiente se habilita al completar; **libre**: todo abierto.
- La evidencia la decide el servidor (`POST …/evidence`); el cliente solo mide.
- Un intento abierto a la vez; plazo del servidor; ajustes de inclusión sin explicación.
- `reviewPolicy` decide qué se ve al terminar; el acudiente ve lo mismo que el estudiante.
- Acceso vencido: `/resultados` y `/certificados` siguen; `/aprender` muestra la puerta.
- Cartera: «Pagar en línea» solo si la institución tiene Wompi; transferencia siempre.

---

## 7. Lo que se vio hoy y aún no está bien (deuda honesta)

- Escritorio: el rail del player queda alto y vacío al lado de un vídeo grande.
- «Te quedan 0 de 1» con un intento en curso.
- Botones que solo dicen «Enviando…» / «Empezando…» sin tiempo de espera ni mensaje si el
  servidor tarda (hoy tardó 15–60 s en desarrollo; en producción menos, pero en datos
  móviles pasa).
- `/calendario` sin agrupar y sin acción; `/resultados` con tres tablas casi vacías para el
  nuevo; `/mi-cuenta` con fechas ISO.
- No hay «Explora más programas» (datos del cliente) ni offline real (decisión).
- Verificado después de la opinión externa (mismo día): el intento en escritorio y a 500 px
  (una pregunta por pantalla, índice debajo; la tarjeta de estado `sticky` se mete bajo la
  barra superior); el reloj mostraba el fin de acceso como cuenta atrás («124440:38») cuando
  no hay límite de tiempo — arreglado (solo plazos de menos de 24 h, con horas); `/aprender`
  y el player a 500 px (rail plegado en «Ruta del módulo», menú como icono, barra fija en
  dos líneas). **Sigue sin verse**: la transcripción plegada, la entrega por archivo y 360 px
  reales (Chrome de escritorio no baja de 500 y la CSP bloquea un `iframe`).

---

## 8. Propuesta (lo que haría un equipo de producto maduro)

1. **`/aprender` como «hoy», no como catálogo.** Una sola tarjeta de tarea arriba (ya está)
   y **la ruta plegada por módulo**, con el módulo actual abierto; las otras matrículas
   detrás de un selector en la cabecera («Aprende a rapear · RAP-1 ▾»), no como lista.
   Motivo: en móvil la ruta hoy queda a dos pantallas de distancia.
2. **Player: contenido a pantalla completa en móvil.** Rail y cabecera se pliegan en una
   barra superior fina «‹ Tema 1 de 2 · Rimas y ritmo»; la barra fija abajo se queda. En
   escritorio, el rail se convierte en un panel lateral plegable (icono) para dejar el ancho
   al vídeo.
3. **Una espera que se ve.** Todo botón de red pasa por el mismo patrón: «Enviando…» +
   barra de progreso indeterminada + a los 8 s «Está tardando más de lo normal; no cierres
   esta pantalla» + a los 30 s «No pudimos confirmar; tu texto se guardó aquí, reintenta».
   Es el fallo más caro con datos móviles.
4. **Examen: el estado dice la verdad.** «Tienes un intento en curso» sustituye a «Te quedan
   0 de 1» cuando hay uno abierto; una sola acción («Continuar el intento»); «Qué esperar»
   pasa a lista bajo el botón en móvil.
5. **Calendario por semana** con agrupación («Esta semana», «Octubre») y acción en la fila
   (unirse, abrir examen, pagar); las fechas de fin de acceso, una sola vez y con distancia
   («faltan 84 días»).
6. **Resultados para quien empieza**: una tarjeta por examen con su estado y «por qué» (lo
   habilita “…”), y las tablas solo cuando hay datos. «Bloqueado» siempre con motivo.
7. **Mi cuenta en lenguaje de persona**: «Debes $ 200.000 desde el 18 de septiembre»,
   fechas en palabras, la consecuencia explícita para el adulto («Si no pagas antes del …,
   se te restringe …»; para menor, nunca aparece).
8. **Notificaciones accionables**: cada aviso con su verbo («Reenviar la actividad», «Ver la
   nota», «Pagar») y agrupadas por día.
9. **Biblioteca con buscador** y tipo (documento/audio/grabación) cuando haya más de diez
   recursos; hoy vacía, pero es donde llegará el volumen.
10. **Medir con lo que ya existe**: `/inicio` ya muestra los embudos; añadir a la barra fija
    del player un evento «acción principal pulsada» (sin PII) para cerrar el segundo embudo.

Orden: 3 (evita pérdida de trabajo) → 2 y 1 (móvil, donde está el uso) → 4 y 6 (examen, donde
está el miedo) → 7 y 8 → 5 y 9 → 10.

---

## 9. Prompt para pedir una segunda opinión a otro asistente

```
Actúa como un/a lead de producto y diseño UX con experiencia en plataformas educativas
para adultos en contextos de bajos recursos (móvil de gama media, datos limitados,
accesibilidad WCAG 2.2 AA obligatoria). Te paso el brief del área del estudiante de
«Colombia Estudia», una plataforma para terminar el bachillerato en Colombia (adjunto:
docs/ux/brief-estudiante-2309.md). Reglas que no se discuten: la mora nunca toca el acceso
de un menor; sin diagnósticos de salud; sin emojis ni exclamaciones en la UI; se diseña a
360 px; el sistema visual (tokens, espaciados, componentes) no se cambia.

Quiero:
1. Un diagnóstico por pantalla (4.1 a 4.11): qué confunde, qué sobra, qué falta, con la
   severidad (1 bloquea, 2 frena, 3 pule) y el porqué en una frase.
2. Los tres flujos con más riesgo de abandono y, para cada uno, el cambio de menor coste que
   más lo reduce.
3. Una crítica de la propuesta §8: con qué estás de acuerdo, qué quitarías, qué falta.
4. Para el player y el examen en móvil (360 px): una descripción exacta de la pantalla
   (orden, alturas aproximadas, qué es fijo y qué hace scroll), sin dibujar.
5. Cómo tratar las esperas de red largas (5–60 s) sin que la persona pierda lo que escribió.

Responde en español, sin adornos, con evidencia del brief (cita la sección). No propongas
cambiar el sistema visual ni añadir gamificación, puntos o rankings.
```

---

## 10. Cómo devolver las opiniones

Pégalas tal cual. Se consolidan en `docs/ux/decision-estudiante-2309.md` con el mismo
método que `decision-ux-2309.md`: cada punto con «sí / no / sí con cambios», la razón, y la
ola en la que entra.
