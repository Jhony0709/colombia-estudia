# Colombia Estudia — Decisión de dirección UX (23/9/2026)

Consolida dos fuentes: la propuesta del brief (`brief-ui-ux-2309.md` §9, «B») y la auditoría
externa recibida el 23/9 («A», un asistente actuando como lead de diseño). Método: lo que
las dos señalan va primero; lo que viola una restricción se descarta con el motivo; por cada
pantalla queda **una sola dirección**, con lo que se conserva y su ola. Donde A y B difieren,
decido y digo por qué. Si llegan más opiniones, se cruzan contra esta tabla.

## 1. Coincidencias (van primero)

| Tema                                                                               | A      | B     | Decisión                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player como pantalla de tarea con barra fija abajo y la actividad como paso propio | sev. 5 | §9.2  | **Sí.** Es la mejora de mayor impacto y la primera de la ola 1.                                                                                                                                      |
| Ficha de cohorte con navegación interna y una sola acción en cabecera              | sev. 5 | §9.3  | **Sí**, con el matiz de A: pestañas en escritorio, selector compacto (segmented + Sheet) a 360 px; nunca siete pestañas en móvil.                                                                    |
| Editor con la «Preparación» persistente y «Ver como estudiante»                    | sev. 4 | §9.4  | **Sí**: rail derecho fijo de 300–320 px en escritorio; pestaña «Preparación» en móvil. «Ver como estudiante» abre la ruta real en pestaña nueva (requiere una vista previa de asignación, ver §4).   |
| Constructor como centro de gravedad del instructor; Temas/Exámenes como búsqueda   | sev. 3 | §9.5  | **Sí.** `/contenido` aterriza en el constructor del último programa tocado (o en Programas si hay varios sin elegir).                                                                                |
| Catálogo único de estados (palabra + icono + color) como componente, no solo doc   | sev. — | §9.6  | **Sí**: `StatusBadge` por dominio (matrícula, cartera, versión, entrega, intento, cohorte) en `components/molecules`, y los mapas locales desaparecen.                                               |
| Instrumentar embudos antes de cambiar más                                          | ola 1  | §9.10 | **Sí, y primero.** Tres embudos: registro → primer tema completado; abrir cohorte → primera matrícula activa; entrega → revisión. Eventos en `LearningEvent`/`AuditLog` ya existentes + tres nuevos. |
| «En riesgo» marca matrículas recién creadas                                        | sev. 5 | §8    | **Sí, es dominio**: `metrics.ts#atRisk` ignora matrículas con menos de 7 días o cohortes con `startsOn` futuro. Cambio pequeño en `packages/domain` (protegido, pide confirmación).                  |

## 2. Diferencias, resueltas

| Tema                                                                 | A                                                                                                                    | B                                  | Decisión y motivo                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navegación                                                           | Shell común con selector de espacios; navegación local distinta (superior para estudiar/familia, lateral para staff) | Una barra superior única para todo | **A.** La barra lateral es la herramienta correcta para la profundidad del staff, y la superior para tareas personales en móvil. Lo que se unifica es el **cambio de espacio** (un selector en la marca, solo si la persona tiene más de uno) y la persona/tema/salir. Se retira §9.1 tal como estaba. |
| `/aprender`                                                          | Una tarjeta principal «Continuar» + selector compacto de otras matrículas + ruta                                     | Rejilla de tarjetas iguales        | **A con una condición de negocio.** Jhonny pidió el 21/9 ver **todas** sus matrículas; se conservan visibles, pero como lista compacta bajo la tarjeta principal (la de actividad más reciente), no como rejilla de tarjetas iguales antes de la tarea. La ruta sigue debajo.                          |
| Onboarding del primer ingreso                                        | Un bloque «Empieza por aquí» dentro de `/aprender`                                                                   | Una pantalla propia                | **A.** Menos pasos, misma orientación, sin ruta nueva. El bloque aparece mientras no haya ningún tema empezado y se cierra solo.                                                                                                                                                                       |
| Tablas del staff en móvil                                            | Filas responsivas con 2–3 datos y detalle en Sheet                                                                   | Tarjetas por fila                  | **A.** Las tarjetas destruyen la comparación. `DataTable` gana un modo `compactRows` bajo 640 px con `primary`/`secondary` por columna y el resto en la hoja de la fila.                                                                                                                               |
| Consentimiento digital del acudiente                                 | En contra: contradice el contrato (papel)                                                                            | Marcado como decisión de negocio   | **Fuera** hasta que la institución y su asesoría lo decidan; el brief ya lo marcaba así. `/familia` sigue sin firmar nada.                                                                                                                                                                             |
| Sin red en el player                                                 | sev. 5, ola 1                                                                                                        | Deuda                              | **Sí, acotado.** Ola 1: banner `role="status"`, contenido ya cargado sigue usable, evidencia y entrega en cola local con reintento (como el intento). **No** contenido descargable ni service worker: es coste de ingeniería y decisión de producto (datos limitados ≠ sin conexión).                  |
| Aterrizaje de ADMIN                                                  | Pantalla de situación, no de configuración                                                                           | —                                  | **Sí, en dos tiempos.** Ahora: ADMIN aterriza en `/cohortes` (donde está la operación) — un cambio de `home.ts`. Ola 3: `/inicio` de staff con «requiere atención» (actividades por revisar, cohortes por abrir con faltantes, invitaciones que vencen, cuotas vencidas), enlazado a cada sitio.       |
| `/admin/institucion` con cuatro dominios                             | Separar                                                                                                              | —                                  | **No ahora.** Cada sección ya tiene su propio botón de guardar (marca/contacto/política; registro público); separar rutas no reduce el riesgo y sí añade navegación. Se revisa cuando entren más ajustes.                                                                                              |
| Auditoría contextual («último cambio, por quién»)                    | Sí                                                                                                                   | —                                  | **Sí, barato.** Los rails de cohortes y personas ya lo enseñan en lenguaje llano; se añade la misma línea en la cabecera de cohorte, tema y examen («Publicado por X el …», «Abierta por X el …»).                                                                                                     |
| `/familia`: avisos prioritarios arriba; separar académico de cartera | Sí (sev. 3–4)                                                                                                        | §9.8                               | **Sí.** Bloque «Requiere tu atención» arriba (cuota vencida, actividad devuelta, sesión hoy) y, en el detalle, la cartera como **última** sección con su propio encabezado y separación de 48 px (cambio de área), para que el dinero nunca parezca condición del avance (regla innegociable 1).       |
| Prominencia de Abrir/Cerrar                                          | Contextual: Abrir cuando planeada; Matricular cuando abierta; Cerrar en menú de gestión                              | Una acción en cabecera             | **A.** Es la aplicación correcta de «una acción principal».                                                                                                                                                                                                                                            |

## 3. Descartes

- Nada de lo propuesto viola una restricción salvo el consentimiento digital (fuera, ver arriba).
- «Tercera columna» en player o editor: descartada por las dos fuentes.
- Push, offline completo, una pantalla nueva de onboarding: fuera.

## 4. Dirección por pantalla (lo que se construye)

**`/aprender/tema/[id]`** — cabecera compacta «Módulo 2 · Tema 3 de 8» + título; contenido a
68ch; transcripción y preferencias detrás de botones (Sheet); al final del contenido, paso
**«Practica»** (actividad + entrega/estado) como bloque propio con su encabezado; barra fija
abajo: estado de evidencia a la izquierda, **una** acción a la derecha que cambia por estado
(Continuar · Enviar actividad · Enviar nueva versión · Ir al examen), con el motivo si está
bloqueada; «Reportar un problema» dentro del menú de la cabecera. Rail de ruta a 240 px en
escritorio. Banner sin red + cola local. Conserva: 68ch, transcripción sincronizada, versión
congelada, autosave, explicación del bloqueo. **Ola 1.**

**`/aprender`** — «Continúa donde quedaste» (tarjeta grande: programa, tema, forma, minutos,
avance x/y, botón); si no ha empezado nada, el bloque «Empieza por aquí» ocupa ese sitio;
debajo, lista compacta «Tus otros programas» (una fila por matrícula, con avance y estado);
debajo, la ruta de la matrícula activa. Estados terminales igual que hoy. **Ola 1.**

**`/cohortes/[id]`** — cabecera con estado y una acción contextual (Abrir la cohorte /
Matricular a alguien; Cerrar y Archivar en menú «Gestión»); navegación secundaria Resumen ·
Ruta (asignaciones + actualizaciones) · Personas (matrículas, invitaciones, importar) ·
Actividades · Avance · Sesiones · Cartera; en móvil, un `SectionNav` con select + Sheet.
Resumen: alertas operativas primero («3 actividades esperan revisión», «2 contenidos nuevos
disponibles»), luego 4 cifras. Conserva la hoja de matrícula, la revisión previa a abrir y
las actualizaciones explícitas. **Ola 2.**

**`/contenido/temas/[id]` y `/examenes/[id]`** — editor 68–76ch + rail derecho fijo
«Preparación» con Publicar y Vista previa al pie del rail; «Datos del tema» y «Actividad» como
acordeones dentro del cuerpo (la actividad justo después del contenido, como en el player);
avisos integrados en el rail (cada uno lleva al bloque); «Ver como estudiante». Móvil: tabs
Contenido · Actividad · Preparación y barra inferior con Vista previa / Publicar. Conserva:
versionado, editor por bloques, accesibilidad por vídeo, `PageHelp`, publicación bloqueada
por errores. **Ola 2.**

**`/familia` y `/familia/[id]`** — bloque «Requiere tu atención» arriba; detalle con la
cartera al final, separada. **Ola 3** (o antes si sobra tiempo en la 1: es pequeño).

**Shell** — selector de espacios en la marca (solo multi-rol); persona/tema/salir iguales en
las dos barras; ADMIN aterriza en `/cohortes`. **Ola 3** (el aterrizaje, ahora).

**Sistema** — nuevos: `StickyActionBar`, `SectionNav`, `ReadinessChecklist` (extrae el panel
actual), `ConnectivityBanner`, `StatusBadge` por dominio, `DataTable compactRows`. No se toca
ningún token, espaciado, superficie, radio ni densidad. **Transversal**, cada uno en la ola de
la pantalla que lo estrena.

## 5. Olas y criterios

**Ola 1 — aprender sin perderse (2–3 semanas).** Telemetría de los tres embudos; player;
`/aprender`; `StickyActionBar`; `ConnectivityBanner` + cola local de evidencia y entrega;
«Empieza por aquí». Éxito: +10 % de primer tema completado tras registro/invitación; −20 %
de abandono entre abrir un tema y completar la acción requerida; < 2 % de sesiones con error
no recuperado.

**Ola 2 — operar y publicar con menos fricción (2–3 semanas).** Ficha de cohorte con
`SectionNav`; acción contextual; editor con rail; «Ver como estudiante»; `StatusBadge`;
auditoría contextual en cabeceras; `atRisk` en dominio. Éxito: −25 % de tiempo mediano para
abrir una cohorte; −30 % de navegaciones para publicar tema + examen; cero aperturas con
contenido omitido «sin darse cuenta» (la revisión ya lo evita; se mide que nadie vuelva a
añadir en la primera hora).

**Ola 3 — coherencia multirol (2–3 semanas).** Selector de espacios; `/inicio` de staff;
`DataTable compactRows`; `/familia` priorizada; migración completa a `StatusBadge`. Éxito:
≥ 95 % de estados por el componente; cero acciones críticas inaccesibles a 360 px; cero
regresiones WCAG en CI.

## 6. Lo que necesita decisión de negocio antes de construir

Consentimiento digital del acudiente; contenido descargable / offline real; «Explora más
programas» (datos del cliente); Fase D (técnicos e inglés); cambio de la regla «en riesgo»
(dominio protegido: pide confirmación explícita).
