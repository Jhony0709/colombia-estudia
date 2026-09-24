# Colombia Estudia — Brief de UI/UX (23/9/2026)

Para un especialista en UI/UX que no ha visto el producto. Describe lo que **existe hoy**
(rutas, layouts, espaciados, componentes, funcionalidades, flujos) y las reglas de negocio
que condicionan el diseño; termina con una propuesta y con un prompt para pedir una segunda
opinión a otro asistente. Todo lo que aquí se afirma sale del código y de `reference/`
(el contrato); donde algo es opinión, se dice.

Lo que **no** se negocia (viene de la ley y del contrato con la institución):

1. **La mora nunca toca el acceso académico de un menor** (`acceso-y-cartera.md` §2).
2. **WCAG 2.2 AA es una puerta de CI** (`pa11y-ci`), no una aspiración.
3. **Ningún diagnóstico de salud en la base de datos** (los ajustes de inclusión describen
   apoyos, no condiciones).
4. Datos personales bajo Ley 1581: el documento, la fecha de nacimiento y el correo nunca
   van en una URL; el consentimiento de un menor lo firma su acudiente **en papel**.

---

## 1. Para quién y en qué condiciones (`plan/11-ux.md`)

Adultos que terminan el bachillerato de noche, **en un celular de gama media, con datos
limitados** y a veces con lector de pantalla; menores con acudiente; operación de la
institución en un portátil con Excel al lado; un aliado (empresa o entidad que financia
cohortes) que quiere un archivo. La UI no tiene que impresionar: tiene que no confundir, no
perder nada y funcionar con una mano.

Principios en vigor: una acción principal por pantalla; nunca una pantalla en blanco (todo
vacío/error dice qué pasó, qué hacer y a quién escribir); nada se pierde (autosave, anular en
vez de borrar); el sistema dice la verdad (progreso con número, tiempos del servidor); copy
en segunda persona, sin jerga, **sin emojis, sin exclamaciones**; móvil primero (se diseña a
360 px, se comprueba a 320; `touchMin` 44 px); accesible por construcción.

---

## 2. Sistema visual vigente (`reference/03-ui/tokens.md`)

**Tokens semánticos, nunca literales**, cada uno con valor claro y oscuro (tema por cookie
`ce-theme` + clase en `<html>`; tres opciones: claro, oscuro, sistema).

- Superficies (cinco, no habrá más): `canvas` (fondo), `base` (paneles, formularios, player),
  `sunken` (campos, barras de progreso, chips, hover de fila), `raised` (menú, popover,
  diálogo), `note` (aviso del autor). **Prohibido anidar `base` dentro de `base`.**
- Texto: `default`, `muted` (metadatos), `subtle` (deshabilitado), `onAccent`, `link`
  (subrayado siempre).
- Acento y estados: `accent.base` `#0047BA` (marca; hover `#0052D6`, active `#0D2E6E`);
  `status.{success,warning,error,info,locked}` con `.base/.muted/.onBase`, **siempre con
  icono y texto**, nunca solo color. Marca: Azul `#0047BA`, Azul oscuro `#0D2E6E`, Amarillo
  `#F5C400` (solo en la portada y en la línea bajo el `h1`), Rojo `#D72638`, Gris `#F3F5F8`.
- Tipografía (roles): `display`, `heading` (h1), `subheading` (h2), `body` (16 px mínimo,
  1.5), `data` (tabular-nums: notas, cuotas, cronómetro), `caption`, `overline`, `label`,
  `body-emphasis` (peso 600, única forma de destacar). Familia Atkinson Hyperlegible Next,
  self-hosted (la portada usa Lexend, la de marca).
- Espaciado `space.{1,2,3,4,6,8,12}` = 4/8/12/16/24/32/48 px, con **significado fijo**: 4
  icono-texto y etiqueta-pista; 8 etiqueta-campo; 12 controles relacionados; 16 elementos
  distintos de un bloque; 24 bloques de una sección; 32 entre secciones; 48 cambio de área.
  Regla: si dos cosas están más juntas que dos que sí se relacionan, la jerarquía miente.
- Densidad: `compact` (control 36 / fila 40 / gap 8) solo en staff con ratón; `default`
  (44/48/12); `comfortable` (48/56/16). Prohibido `compact` en player, intento, cartera.
- Radios: `control` 8, `card` 16, `sheet` 20, `pill`. Elevación con nombre: `none`,
  `resting` (tarjeta en reposo; **el borde agrupa, la sombra refuerza**), `floating`
  (menú/popover), `modal` (diálogo/hoja).
- Foco: anillo `#0D2E6E`, 3 px, offset 3 px, global. Contraste medido: 70 pares, 0 fallos.
- Anchos: marco `max-w-5xl`/`contentMax` 64rem; texto que se lee `readingWidth` 68ch;
  barra lateral del staff 16rem.
- Restricción técnica: la CSP no admite `style` en línea → barras de progreso son SVG con
  `<rect width>`; nada de estilos calculados en línea.

---

## 3. Gramática de una pantalla (`layout-y-componentes.md`)

```
SideNav / StudentTopNav   navegación del área
Page                      columna centrada (max-w-5xl), gap 32 entre secciones
├── PageHeader            back (una ruta arriba) · overline · h1 (foco al navegar) · description · UNA acción principal (+ una secundaria)
├── PageSection (h2)      title obligatorio; acción de sección en su ranura; `card` opcional
│   └── Card              panel con nombre (h3) o `labelledBy`; una acción como mucho
└── …
```

Componentes con reglas propias: `Sheet` (hoja por la derecha, `elevation-modal`, `narrow`
28rem / `reading` 48rem; para contenido y flujos cortos sin salir de la pantalla);
`PageHelp` (botón fijo abajo-derecha que abre una hoja con la ayuda declarada por la
pantalla; último del DOM); `Tooltip` (solo enseña el nombre de un botón de icono, nunca lo
sustituye; no en cierre de diálogos); `Badge` (píldora: la palabra es el estado, el color
refuerza); `Alert` (`info/success/warning/error`, con icono); `DataTable` (caption, columnas
`numeric`/`narrow`, `empty` con `EmptyState`, scroll propio); `StatCard`/`StatGrid` (cifra +
etiqueta + icono, enlazada a donde se actúa; 3 o 4 por fila); `Dropdown` (HeroUI-style sobre
Radix + motion: secciones, selección, fila de iconos; reduced-motion); `EmptyState` (título,
frase, correo de soporte); `FormField` (etiqueta visible, pista debajo, error debajo con
sugerencia, `aria-describedby`); `Breadcrumb` (solo donde hay tres niveles reales).

Estados obligatorios de toda pantalla con datos: cargando (skeleton por sección), vacío,
error (`role="alert"`, reintentar, `requestId`), sin red (banner), terminal (acceso vencido,
cohorte por iniciar, matrícula completada/retirada) y éxito (anuncio `useAnnounce`;
persistente si es financiero).

---

## 4. Áreas y navegación

| Área                        | Quién                                    | Navegación                                                                                                                                                                                                                                                                                                                | Inicio                                                                                                                       |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Pública                     | cualquiera                               | cabecera de la portada (Programas · Cómo funciona · Preguntas · Iniciar sesión · **Regístrate** · Escríbenos)                                                                                                                                                                                                             | `/`                                                                                                                          |
| Estudiante `(student)`      | STUDENT (o cualquier matrícula)          | **barra superior** `StudentTopNav`: marca → pestañas (Mis programas · Calendario · Biblioteca) → campana con contador → menú de la persona (Mi historial: Resultados, Constancias, Mi cuenta, Mi familia · fila de tema claro/oscuro/sistema · Cerrar sesión)                                                             | `/aprender`                                                                                                                  |
| Acudiente `(familia)`       | GUARDIAN o `progress.read.ward`          | la misma barra: Mi familia · (Mis programas si además estudia)                                                                                                                                                                                                                                                            | `/familia`                                                                                                                   |
| Staff `(staff)` + `(admin)` | ADMIN, OPERATIONS, INSTRUCTOR, INCLUSION | **barra lateral** `SideNav` (16rem; cajón en móvil) agrupada: _Plan de estudios_ (Asignaturas, Programas) · _Contenido_ (Temas, Exámenes) · _Operación_ (Cohortes, Personas, Cartera, Inclusión) · _Administración_ (Institución, Políticas); abajo: Notificaciones, tema, persona, Cerrar sesión. Filtrada por capacidad | según rol: ADMIN `/admin/institucion`, OPERATIONS `/cohortes`, INSTRUCTOR `/contenido`, INCLUSIÓN `/admin/inclusion/reporte` |
| Aliado `(partner)`          | PARTNER_CONTACT                          | cabecera propia                                                                                                                                                                                                                                                                                                           | `/aliado`                                                                                                                    |

Los roles son membresías; **los permisos son capacidades con alcance** (institución, cohorte,
matrícula, aliado) resueltas en el servidor (`packages/domain/capabilities.ts`). Cada pantalla
enseña solo lo que la capacidad permite; el diseño nunca debe depender del rol.

---

## 5. Pantallas

Formato: **ruta** · quién · propósito · layout y contenido · acciones · estados · reglas.

### 5.1 Público

**`/` Portada.** Cabecera fija (marca, anclas, «Iniciar sesión», «Regístrate», «Escríbenos»
por WhatsApp), hero con ciudad de fondo, dos CTA («Explorar programas», «Cómo funciona»),
barra de datos, programas, cómo funciona (pasos), editorial, FAQ, CTA final, pie, botón
flotante de contacto. Piel propia (`site.css`, Lexend, amarillo de marca). Con sesión el
botón pasa a «Ingresar». _Pendiente de negocio (Fase D):_ sección de técnicos laborales e
inglés con los datos del cliente.

**`/auth/login`.** Tarjeta centrada (max-w-md): correo + contraseña (mostrar/ocultar),
«Continuar»; debajo «¿Olvidaste tu contraseña?», «¿No tienes cuenta? Regístrate», «Entrar
con enlace por correo». Error genérico (no revela si el correo existe). Staff → `/auth/mfa`
(TOTP obligatorio para ADMIN/OPERATIONS).

**`/registro` (Fase B, 23/9).** Un paso, tarjeta centrada: nombre y apellido en dos columnas,
correo, teléfono (opcional), fecha de nacimiento, contraseña (≥12), casilla de política de
datos (solo se enseña a mayores; a menores, un aviso). Éxito: «¡Cuenta creada!» + resultado
de la matrícula («Ya estás en {cohorte}» / «el equipo te matriculará») + «Entrar». Reglas:
correo ya registrado → «inicia sesión o pide tu invitación»; menor → cuenta sin consentimiento
ni matrícula; la matrícula automática va a la **cohorte de introducción** que elige ADMIN.

**`/invitacion/[token]`.** Tres pasos cortos: bienvenida con el nombre → contraseña → política
(mayores) → éxito y redirección. Errores: vencida/usada/no válida con «Pedir una invitación
nueva». Es el camino para quien operación dio de alta (sin clave adivinable).

**`/auth/recuperar`, `/auth/restablecer`, `/auth/mfa`, `/certificado/[code]`** (verificación
pública de una constancia: estudiante, programa, módulo, institución, fecha; «revocada»).

### 5.2 Estudiante (barra superior; se diseña a 360 px)

**`/aprender` Mis programas.** Cabecera «Mis programas». Rejilla de tarjetas, una por
matrícula: overline programa, nombre de cohorte, badge de estado, barra de avance SVG con «x
de y temas», «Seguir con: {tema}» (con forma y duración: «Vídeo · 5 min»), línea «Tu cohorte
la financia una entidad aliada» si aplica (sin nombrar al aliado). Debajo, **la ruta** de la
matrícula elegida (`?matricula=`): módulos → temas (estado, forma, minutos) → exámenes
colgando del tema → siguiente tema; en progresión lineal lo bloqueado lleva candado y «Se
habilita al completar…». Estados terminales con fecha y contacto (por iniciar, vencido,
completado, retirado, menor sin consentimiento). _Pendiente de negocio:_ «Explora más
programas» (intro gratis, bachillerato por grado, técnicos, inglés).

**`/aprender/tema/[id]` Player.** Dos columnas en escritorio: **rail de la ruta** a la
izquierda (dónde estoy, qué sigue) y el contenido a 68ch; en móvil el rail va detrás. Orden:
aviso si el tema se completa con actividad → preferencias de lectura (tamaño, interlineado,
ancho; en el navegador) → aviso de recursos que faltan → artículo (Markdown saneado; vídeos
Vimeo con transcripción sincronizada, clic al segundo) → panel de transcripción → grabador
de evidencia (el servidor decide `COMPLETED`) → **sección «Actividad»** (instrucciones del
autor + «se entrega con texto/archivo/los dos») → **formulario de entrega** (solo lo que
aplica; PDF/PNG/JPG ≤20 MB) o su estado: «en revisión» (con «Corregir antes de la revisión»),
«devuelta» (comentario + reenviar), «aprobada» → anterior/siguiente → «Reportar un
problema». Reglas: el tema muestra la **versión asignada a la cohorte**, no la última
publicada; «Siguiente» se habilita con evidencia y dice por qué si no.

**`/aprender/examen/[id]` y `/intento/[attemptId]`.** Pantalla previa que quita el miedo
(intentos restantes, tiempo ya con ajuste, «tus respuestas se guardan solas») → intento: una
pregunta por pantalla en móvil / columna en escritorio, índice, autosave con cola local,
cronómetro `role="timer"` ocultable con hitos anunciados, entrega con diálogo que lista las
sin responder → resultado según `reviewPolicy` (nada / solo nota / todo tras calificar / todo
tras la fecha). Plazo del servidor (`deadlineAt`).

**`/aprender/resultados`.** Exámenes de la ruta con la mejor nota visible, intentos, notas
por asignatura. Disponible con el acceso vencido. **`/calendario`** (fechas, vencimientos,
sesiones en vivo con «Unirse» desde 15 min antes), **`/biblioteca`** (recursos por módulo),
**`/certificados`** (constancias con enlace público), **`/mi-cuenta`** (cuotas, pagos,
acuerdo; «Pagar en línea» si Wompi está configurado; «Datos para transferencia» siempre;
vuelta del checkout con «pago en proceso»), **`/notificaciones`**.

### 5.3 Acudiente (Fase C, 23/9)

**`/familia`.** Cabecera «Mi familia» («solo lectura: quien estudia es ella»). Rejilla de
tarjetas, una por matrícula de pupilo: programa, nombre, cohorte, badges (estado de matrícula
y, si es responsable de pago, estado de cartera), barra de avance, «Acceso hasta», «Ver el
avance de {nombre}». Vacío: «cuando el equipo registre tu acudencia…».

**`/familia/[enrollmentId]`.** Breadcrumb Mi familia › nombre; cabecera con programa, cohorte,
estado. Secciones: **Avance por módulo** (tabla módulo / temas x/y), **Exámenes** (mejor
nota que el estudiante ya puede ver, o «sin nota todavía»), **Notas por asignatura**,
**Cuotas** (solo responsable de pago: estado, próxima cuota, totales, «Pagar en línea»,
datos de transferencia). Reglas: el acudiente ve exactamente lo que el estudiante puede ver
(misma `reviewPolicy`) y nunca entra al player ni presenta exámenes.

### 5.4 Staff — Contenido (INSTRUCTOR, ADMIN)

**`/contenido/programas`** (lista de programas con módulos: crear, reordenar, archivar;
botón «Construir la ruta») · **`/contenido/asignaturas`** (dos campos en línea).

**`/contenido/programas/[id]` Constructor (23/9).** `Page wide`. Cabecera con «x de y
publicadas». Un bloque por módulo («Módulo N», nombre, «x de y publicados», «+ Añadir
contenido» → menú Tema / Examen del módulo); filas con icono, meta (forma · asignatura ·
minutos / tipo · preguntas) y badge de estado (Sin versión / Borrador vN / Borrador sobre
publicada / Publicado vN); los exámenes de un tema cuelgan con línea izquierda; bajo un tema
sin examen, «Añadir el examen de este tema». Alta en **hoja**: tema = título + asignatura
prellenada + «¿Cómo completa el estudiante este tema?» (revisar el contenido / actividad
aprobada); examen = título + tipo. Al crear, va al editor. Regla clave: **el admin ve la ruta
con la misma función que la ordena para el estudiante** (`sortItems`).

**`/contenido/temas`** (lista filtrable por programa/estado, agrupada por módulo, KPIs) ·
**`/contenido/examenes`** (lista con tipo, módulo, tema, preguntas, estado).

**`/contenido/temas/[id]` Editor de tema.** Cabecera: overline asignatura, h1 título,
acciones «Vista previa» (hoja `reading`, mismo render que el player) y «Publicar esta
versión» (diálogo). Línea de versión + estado de guardado (autosave cada 5 s, `role=status`).
**Panel «Preparación»** (rejilla 3 col.: En la ruta con «Ver la ruta» · Contenido · Vídeos ·
Duración · Actividad · Examen del tema con «Añadir desde la ruta» · Publicación con cohortes
abiertas que ya lo tienen / podrán añadirlo; icono + palabra, nunca solo color). «Datos del
tema» plegado (título, objetivo, asignatura, módulo, forma de completar; bloqueados con
versión publicada). **Editor de bloques** (sin contenteditable; texto, sección, lista, cita,
vídeo Vimeo con badge «Accesible / Sin subtítulos ni transcripción» y engranaje → diálogo de
accesibilidad, imagen con `alt`, fórmula, tabla, código; formato en línea; minutos estimados).
**Sección «Actividad»** (solo temas de actividad: instrucciones Markdown + Texto / Archivo /
Texto o archivo + guardar; no versionada, se corrige en caliente). «Avisos» (solo si hay:
lista con «ir a la línea»). Diálogo de publicar: bloqueado si hay errores; casilla «reabre el
tema para quien ya lo completó»; frase sobre cohortes que podrán añadirlo. Ayuda contextual
(`PageHelp`).

**`/contenido/examenes/[id]` Editor de examen.** Igual estructura: cabecera («Mostrar las
respuestas correctas» — la clave nunca viaja al HTML hasta pedirla — y «Publicar»), panel
«Preparación» (En la ruta · Preguntas · Avisos · Reglas del intento · Publicación), sección
«Preguntas» (instrucciones + constructor: enunciado, cómo se responde, puntos, opciones, mover)
y «Reglas del intento» (intentos, minutos, % para aprobar, qué ve el estudiante después).

### 5.5 Staff — Operación (OPERATIONS, ADMIN; parte para INSTRUCTOR)

**`/cohortes`.** KPIs (abiertas, planificadas, matrículas activas, terminan en 30 días),
filtros en la URL (búsqueda, estado, programa), tabla (código, programa, fechas, matrículas,
estado, Abrir/Cerrar), «Nueva cohorte» (hoja), rail derecho: «Próximos 30 días» y «Actividad
reciente» (auditoría en lenguaje llano).

**`/cohortes/[id]` Ficha de cohorte.** Cabecera: programa, «CÓDIGO — nombre», estado ·
progresión · fechas; acciones secundarias Avance · Actividades (con contador de pendientes)
· Importar desde CSV; **principal: Abrir / Cerrar**. Aviso de estado. **Resumen** (6
`StatCard` enlazadas: activas, menores, actividades por revisar, sesiones próximas; avance
medio y en riesgo solo con capacidad de avance). **«Actualizaciones del programa»** (solo si
hay: piezas publicadas que la cohorte no tiene, «Añadir a la cohorte» / «Añadir todo»).
**Matricular a alguien** → hoja en dos pasos: «Comprobar» (documento o correo, nunca en URL)
→ tarjeta con nombre, mayor/menor, acudiente (con enlace a registrarlo), ya matriculada,
«Cursa también» (lista), acceso hasta, aviso de cartera → «Matricular» (bloqueado con
impedimento a la vista) + grado de entrada (módulo por el que empieza). Invitaciones en lote
(«Preparar el envío» con número real). Sesiones en vivo. Tabla de matrículas (estudiante,
menor, grado de entrada, estado, acceso hasta, Detalle, Prorrogar/Retirar). **Abrir la
cohorte** → hoja de revisión: programa ✓, módulos, temas y exámenes publicados, matrículas,
fechas; aviso con las piezas en borrador; «Volver al contenido» / «Abrir la cohorte» o
«Abrir sin lo pendiente». Regla: abrir **congela** la versión publicada de cada pieza en la
cohorte; una versión nueva no llega sola.

**`/cohortes/[id]/actividades`.** KPIs (en revisión, devueltas, aprobadas, enlazadas a su
filtro), filtros por tema/estado, tabla, hoja lateral con la entrega abierta (texto,
archivo, «Ver lo que se pidió» plegado), «Aprobar» (completa el tema) / «Devolver con
comentario». **`/avance`** (métricas y tabla por estudiante: evidencia / manual aparte,
exámenes, última conexión, en riesgo; exportar CSV). **`/importar`** (3 pasos: plantilla →
validar en seco con errores por fila → confirmar; todo o nada). **`/matriculas/[id]`**
(detalle: progreso por tema, intentos, ajustes de inclusión, cartera; marcar completado a
mano con motivo).

**`/personas`** (KPIs, filtros por rol e invitación, tabla con correo enmascarado, rail de
invitaciones que vencen y actividad) · **`/personas/[id]`** (datos, roles, matrículas,
**Acudencia** —vincular por documento/correo, parentesco, responsable de pago; cada acudiente
dice si ya tiene cuenta o «Enviarle la invitación desde su ficha»—, Consentimientos (papel /
plataforma), Invitación (estado, historial, reenviar, enlace en claro una vez), anonimizar).

**`/cartera`** (tabla por matrícula con estado derivado, próxima cuota, vencido, acuerdo;
filtros en URL; CSV) · **`/cartera/[enrollmentId]`** (plan, cuotas editables sin pagos,
registrar pago en dos pasos, anular, acuerdo con vista previa). **`/aliados`**.

### 5.6 Administración (ADMIN)

**`/admin/institucion`** (marca y contacto con comprobación de contraste del color, política
de datos y versión; **«Registro público»**: cohorte de introducción entre las planeadas o
abiertas) · **`/admin/politicas`** (dos banderas con advertencia) · **`/admin/auditoria`** ·
**`/admin/inclusion/reporte`**.

### 5.7 Aliado

**`/aliado`**: avance de su cohorte (mismas métricas que `/avance`), CSV; cartera solo si
paga el aliado.

---

## 6. Flujos

**A. Registro público → estudiar.** Portada / login → `/registro` → cuenta + matrícula en la
cohorte de introducción → `/aprender` con «Seguir con» el primer tema. Menor: cuenta →
operación registra acudiente → matrícula → consentimiento en papel → entra.

**B. Alta por operación.** `/personas` (o CSV en `/cohortes/[id]/importar`) → matrícula en
hoja (comprobar → matricular) → invitación (enlace 7 días) → `/invitacion/[token]` (3 pasos)
→ `/aprender`.

**C. Producción académica.** `/contenido/programas` → «Construir la ruta» → «+ Añadir
contenido» (tema) → editor: escribir, vídeo con accesibilidad, actividad, minutos → panel de
preparación en verde → publicar → «Añadir el examen de este tema» → editor de examen:
preguntas, clave, reglas → publicar. La ruta del admin es la del estudiante.

**D. Operar una cohorte.** Nueva cohorte → matricular → **Abrir** (revisión: qué se asigna, a
quién, qué falta) → durante: «Actualizaciones del programa» cuando se publica algo nuevo,
actividades por revisar, sesiones en vivo, avance/en riesgo → cerrar.

**E. Estudiar un tema con actividad.** Ruta → tema (versión asignada) → leer/ver con
evidencia → sección Actividad → entregar (texto/archivo según el autor) → «en revisión»
(corregible hasta que alguien la revise) → instructor aprueba (completa el tema) o devuelve →
siguiente tema → examen del tema.

**F. Pagar.** `/mi-cuenta` (o `/familia/[id]` el acudiente responsable) → «Pagar en línea»
(Wompi) o transferencia → vuelta con «en proceso» → webhook confirma → recibo.

**G. Acudiente.** Operación vincula acudencia → invitación al acudiente → `/familia` (lista)
→ `/familia/[id]` (avance, exámenes, notas, cuotas).

---

## 7. Reglas de negocio que condicionan el diseño

- Programa → módulos → temas (con asignatura) → exámenes (del tema, del módulo o
  diagnósticos del programa). Un tema se completa **revisando el contenido** (evidencia de
  vídeo/lectura) o **con una actividad aprobada**; el examen es el paso siguiente, no una
  forma de completar. Unidad: _aprende → practica → demuestra_.
- Versionado: el texto del tema y el examen tienen versiones (borrador → publicada); **la
  cohorte congela la versión al abrirse**; cambiar de versión es una decisión explícita en la
  cohorte (con «reabre el tema» opcional). Las instrucciones de la actividad **no** están
  versionadas: se corrigen en caliente.
- Progresión lineal: lo siguiente se habilita al completar lo anterior; el grado de entrada
  (`startsAtModule`) oculta los módulos anteriores.
- Menores: no se matricula sin acudiente; consentimiento en papel; el acudiente mira, no
  actúa; la cartera del menor es del acudiente responsable.
- Cartera: estados derivados (al día, vencida, en acuerdo, paga aliado); **la mora nunca
  bloquea a un menor**; el aviso de «pide acuerdo antes de otra cohorte» avisa, no bloquea.
- Exámenes: intentos, tiempo (con ajustes de inclusión), % para aprobar, `reviewPolicy`
  decide qué ve el estudiante y, por tanto, el acudiente.
- Accesibilidad de vídeo: sin subtítulos revisados ni transcripción se avisa (bloquea o
  avisa según política); transcripción sincronizada en el player.
- Acceso: `accessUntil` por matrícula; vencido pierde el player pero conserva resultados y
  constancias.
- Auditoría de todo lo que cambia estado (abrir, matricular, publicar, pagar…), mostrada en
  lenguaje llano en los rails.

---

## 8. Deuda y puntos débiles conocidos (para que el especialista no los redescubra)

- La barra superior del estudiante y la barra lateral del staff son dos modelos de
  navegación; quien es staff y estudiante salta entre los dos.
- El player en móvil apila mucho (aviso, preferencias, artículo, transcripción, evidencia,
  actividad, entrega, navegación, reportar): falta jerarquía vertical y una barra de acción
  fija abajo (el principio 6 la pide).
- La ficha de cohorte es larga (resumen, actualizaciones, matricular, invitaciones,
  sesiones, tabla) y sin sub-navegación interna; las acciones secundarias de la cabecera son
  cuatro botones iguales.
- «En riesgo» marca a una matrícula recién creada sin eventos (regla de dominio, no de UI).
- Los editores no tienen un modo de «revisar como estudiante» inmediato (la vista previa es
  una hoja, no la ruta completa).
- El formulario de registro y el de invitación son dos piezas paralelas con el mismo objetivo.
- El acudiente no puede firmar el consentimiento del menor en la plataforma.
- Sin estado «sin red» real todavía en el player; sin push.

---

## 9. Propuesta (lo que haría un equipo de producto maduro)

1. **Un modelo de navegación por persona, no por área.** Una barra superior única con
   «espacios» (Estudiar · Familia · Enseñar · Operar · Administrar) que aparecen por
   capacidad; el `SideNav` pasa a ser la navegación _dentro_ del espacio de staff. Elimina el
   salto entre dos modelos y prepara el multi-rol.
2. **El player como pantalla de tarea, con barra fija abajo.** Arriba: título y progreso del
   módulo; centro: contenido a 68ch; abajo, fija: «Anterior · estado de evidencia · Siguiente
   (con motivo si bloqueado)». Actividad y entrega como **paso propio** («Practica») al
   terminar el contenido, no como sección al final del scroll. Transcripción y preferencias
   detrás de un botón, no en línea.
3. **Ficha de cohorte con pestañas semánticas:** Resumen · Ruta (asignaciones y
   actualizaciones) · Personas (matrículas, invitaciones, importar) · Actividades · Avance ·
   Sesiones · Cartera. Cabecera con una sola acción (Abrir/Cerrar) y el resto dentro de su
   pestaña. La hoja de matrícula se queda.
4. **Editor con «lista de salida» persistente.** El panel de preparación pasa a ser una
   columna derecha fija en escritorio (checklist + publicar), y el cuerpo queda para
   escribir. Añadir «Ver como estudiante» que abre la ruta real en una pestaña.
5. **Constructor como centro de gravedad del instructor.** `/contenido` aterriza en el
   constructor del programa del instructor (o en un selector si hay varios), y las listas de
   temas/exámenes pasan a ser vistas secundarias (filtros, búsqueda).
6. **Estados y microcopy unificados.** Un catálogo de estados (matrícula, cartera, versión,
   entrega, intento) con palabra + icono + color fijos, documentado y reutilizado por `Badge`
   en todas las áreas; hoy cada pantalla mapea el suyo.
7. **Onboarding del primer ingreso**: tras registro/invitación, una pantalla «Empieza por
   aquí» con el primer tema, la duración y qué pasa con la actividad; es el momento de mayor
   abandono.
8. **Familia**: añadir «avisos que importan» (cuota próxima, actividad devuelta, sesión en
   vivo) arriba de las tarjetas, y un futuro consentimiento digital con verificación de
   identidad (decisión de negocio, no de UI).
9. **Móvil del staff**: hoy es el escritorio en un cajón; las tablas necesitan vista de
   tarjetas por fila bajo 640 px (matrículas, cartera, personas).
10. **Medir**: instrumentar tres embudos (registro → primer tema completado; abrir cohorte →
    primera matrícula activa; entrega → revisión) antes de cambiar nada más.

Orden sugerido: 2 y 7 (estudiante, donde está el abandono) → 3 y 4 (operación y autor, donde
está el tiempo del cliente) → 1 y 6 (sistema) → 9 → 5 y 8.

---

## 10. Prompt para pedir una segunda opinión a otro asistente

```
Actúa como lead de diseño de producto (UX/UI) con experiencia en plataformas educativas
(Coursera, Khan Academy, Duolingo, Google Classroom) y en productos B2B de operación
(Linear, Notion, Stripe Dashboard). Vas a auditar un producto real y proponer mejoras
concretas, no genéricas.

CONTEXTO: te adjunto el brief «Colombia Estudia — Brief de UI/UX (23/9/2026)». Léelo entero.
Contiene: usuarios y condiciones (celular de gama media, datos limitados, adultos que
terminan el bachillerato de noche, menores con acudiente, operación con Excel al lado),
el sistema visual (tokens, espaciados con significado, densidades, superficies), la
gramática de pantalla, cada pantalla con su layout y sus acciones, siete flujos, las reglas
de negocio y una propuesta previa (§9) que puedes rebatir.

RESTRICCIONES QUE NO SE DISCUTEN: WCAG 2.2 AA; la mora nunca bloquea a un menor; ningún
diagnóstico de salud en la base; datos personales nunca en URL; sin emojis ni exclamaciones
en la UI; móvil primero a 360 px con objetivos de toque de 44 px; color nunca como único
canal (siempre icono + palabra); una acción principal por pantalla.

TAREA, en este orden y con este formato:
1. Diagnóstico por área (estudiante, acudiente, autor de contenido, operación,
   administración): los 3 problemas más graves de cada una, cada uno con (a) evidencia en el
   brief, (b) a quién le duele y cuándo, (c) severidad 1-5.
2. Propuesta de arquitectura de información y navegación (un solo modelo o varios, y por qué).
3. Rediseño de las 4 pantallas de mayor impacto: player del tema, ficha de cohorte, editor de
   tema, /aprender. Para cada una: estructura por zonas en móvil (360 px) y escritorio
   (1280 px), jerarquía de acciones, estados (cargando, vacío, error, terminal), microcopy de
   los 5 textos más importantes en español de Colombia, y qué del diseño actual conservarías.
4. Sistema: qué cambiarías de tokens/espaciado/componentes y qué NO (justifica).
5. Contraste con la propuesta §9 del brief: punto por punto, de acuerdo / en desacuerdo /
   matiz, con argumento.
6. Plan por olas (3 olas, 2-3 semanas cada una) con criterio de éxito medible por ola.

REGLAS DE RESPUESTA: sé específico (nombra pantallas y rutas del brief); no propongas
nada que viole las restricciones; distingue lo que es opinión de lo que es práctica
establecida (cita la fuente o el producto de referencia); no inventes funcionalidades de
negocio nuevas sin marcarlas como «requiere decisión de negocio»; extensión máxima 2.500
palabras; sin emojis.
```

---

## 11. Cómo devolver las opiniones

Para consolidar varias respuestas hace falta que cada una traiga, por punto: pantalla o flujo
afectado, problema, propuesta, severidad y qué conserva. Con eso se cruzan las coincidencias
(las que dos o más fuentes señalan van primero), se descartan las que violan una restricción
y se decide una sola dirección por pantalla.
