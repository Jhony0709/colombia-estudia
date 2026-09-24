# Colombia Estudia — Decisión UX del área del estudiante (23/9/2026)

Consolidación del brief `brief-estudiante-2309.md` §8 con la opinión externa que Jhonny
devolvió el 23/9. Mismo método que `decision-ux-2309.md` —cada punto con veredicto, razón y
ola— más una columna **Confianza**, que la opinión pidió y tiene razón: baja no significa
mala idea, significa que aún no se ha observado bastante producto o dato para
institucionalizarla.

Criterio para juzgar cualquier pantalla del estudiante, tomado de la opinión y adoptado como
regla: cada pantalla responde a una de tres preguntas —**qué tengo que hacer ahora, qué está
pasando con lo que ya hice, qué viene después**— y lo que no responde a ninguna sobra.

## 1. Lo que se cerró antes de decidir

La opinión pedía no institucionalizar nada de player/examen sin ver el intento, la
transcripción, la entrega con archivo y 360 px. Se cerró parte hoy:

| Falta señalada           | Estado 23/9                                                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El intento               | **Visto** (escritorio y 500 px). Fallo encontrado y arreglado: sin límite de tiempo, el reloj mostraba el fin de acceso como cuenta atrás («124440:38»); ahora solo hay reloj si el plazo cae en las próximas 24 h, y con horas. |
| 360 px                   | **500 px, no 360**: la ventana de Chrome no baja de 500 y la CSP bloquea un `iframe`. El diseño móvil (`< sm`) sí se vio: `/aprender`, player y el intento. Lo de 360 sigue provisional.                                         |
| Transcripción desplegada | **No visto**: ningún tema de prueba tiene transcripción. Provisional.                                                                                                                                                            |
| Entrega con archivo      | **No visto**. Provisional.                                                                                                                                                                                                       |

Visto a 500 px: el player pliega el rail en «Ruta del módulo» (`<details>`), el menú es un
icono solo, la barra fija se parte en dos líneas (estado arriba, enlaces abajo); el intento
va una pregunta por pantalla con el índice debajo y Anterior/Siguiente; la tarjeta de estado
del intento (`sticky top-0`) se mete bajo la barra superior al hacer scroll (queda visible,
pero tapa la fila de pestañas); `/aprender` deja la ruta a dos pantallas de distancia.

## 2. Decisiones

| #   | Propuesta                              | Veredicto          | Confianza | Razón y forma final                                                                                                                                                                                                                                                                                                                                                                                            | Ola |
| --- | -------------------------------------- | ------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 0   | Instrumentación mínima                 | **Sí** (nuevo)     | Alta      | La opinión lo sube del último al primer puesto y es correcto: sin medir antes, no se sabrá si el rediseño mejoró algo. Eventos: `student_primary_action_impression`, `student_primary_action_click`, con contexto (pantalla, estado, forma del ítem) y resultado; sin PII; almacenados en `LearningEvent`, que ya existe. Embudo: abre `/aprender` → abre tema → llega al final → completa/entrega → continúa. | E0  |
| 1   | `/aprender` como «hoy»                 | **Sí con cambios** | Alta      | Una sola zona dominante arriba («Continúa donde quedaste → Tema X · 12 min»), luego contexto de programa y avance, luego la ruta. **No** un panel de widgets. El selector de matrícula solo con ≥ 2 (hoy la lista ya se oculta con una). La ruta se **resume**, no se esconde: el módulo actual abierto, los demás plegados con «x de y», para que siempre se sepa dónde se está.                              | E2  |
| 2   | Player en modo tarea                   | **Sí con cambios** | Media     | «Pantalla completa» pasa a **modo tarea**: navegación global reducida, cabecera pequeña «Módulo 2 · Tema 3 de 8», contenido protagonista, barra inferior contextual. En escritorio el rail se queda, plegable, 220–260 px. La secuencia Aprende → Practica → Continúa tiene que sentirse como pasos, no como bloques apilados. Media porque 360 px, transcripción y archivo siguen sin verse.                  | E2  |
| 3   | Patrón único de espera de red          | **Sí con cambios** | Baja      | El problema es real (visto: 15 s y > 1 min sin mensaje). El patrón: respuesta optimista, estado de guardado visible, aviso de conectividad degradada, reintento automático y manual, y **nunca perder texto ni archivo elegido**. Los umbrales 8 s / 30 s **no** se fijan: salen de la telemetría de E0 y del comportamiento técnico por acción. Baja hasta medir.                                             | E1  |
| 4   | «Tienes un intento en curso»           | **Sí**             | Alta      | «Te quedan 0 de 1» es verdad contable y mentira humana. Texto final: «Tienes un intento en curso» y debajo «Cuando lo entregues, habrás usado tu único intento» (o «te quedarán N»). Una sola acción: «Continuar el intento».                                                                                                                                                                                  | E3  |
| 5   | Calendario semanal                     | **No**             | Media     | En 360 px una cuadrícula semanal comprime y obliga a interpretar. Se hace **agenda cronológica accionable**: «Hoy» / «Próximos 7 días» / «Después», con la acción en la fila (unirse, abrir examen, revisar pago) y el fin de acceso una sola vez con distancia («faltan 84 días»). La vista semanal, si acaso, secundaria y solo en escritorio.                                                               | E5  |
| 6   | Resultados en tarjetas con «por qué»   | **Sí con cambios** | Alta      | «Por qué» = composición: estado, mejor intento, visibilidad según política («Se conserva tu mejor intento: 82 %»), y el motivo de un bloqueo («lo habilita “…”»). Nada pedagógico inventado. Una tarjeta por examen, no por métrica; tablas solo cuando hay datos.                                                                                                                                             | E3  |
| 7   | Mi cuenta en lenguaje de persona       | **Sí**             | Alta      | «Tienes una cuota vencida desde el 15 de septiembre» en la superficie; nada de «estado de cartera». Consecuencia contractual explícita para el adulto; para el menor **nunca** aparece deuda junto a acceso, y eso se fija en el componente y el microcopy, no solo en dominio (hoy solo en dominio). Fechas en palabras.                                                                                      | E4  |
| 8   | Notificaciones accionables             | **Sí con cambios** | Alta      | Cada aviso: qué pasó → qué significa → dónde resolverlo, con **una** acción contextual («Ver actividad», «Ver sesión», «Revisar pago»). Sin acciones irreversibles en el feed. Agrupadas por día.                                                                                                                                                                                                              | E4  |
| 9   | Biblioteca con buscador                | **Más adelante**   | Baja      | Está vacía y no se conoce el volumen: diseñar el buscador ahora es optimizar antes de tiempo. Lo primero es que el vacío explique qué aparecerá (ya lo hace). Buscador + filtro por módulo/tipo cuando haya más de ~10 recursos. Condicionada al contenido real.                                                                                                                                               | E6  |
| 10  | Evento de acción principal en la barra | **Sí** → fusionado | Alta      | Es la mitad de la instrumentación del punto 0; se hace ahí, primero.                                                                                                                                                                                                                                                                                                                                           | E0  |

## 3. Olas del estudiante

- **E0 — Medir** — **hecha el 23/9**: `POST /api/learn/events`, `PrimaryActionTracker` en
  `/aprender`, la barra del player y «Antes de empezar»; «El recorrido del estudiante» en
  `/inicio` (seis pasos, personas distintas en 30 días).
- **E1 — Resiliencia de red** — **hecha el 23/9**: `lib/net/slow-request.ts` (un umbral
  provisional, `SLOW_AFTER_MS`, y la duración de cada petición a `student.request.finished`),
  `RequestStatus` («está tardando», «no pudimos» + Reintentar), borrador local del texto
  (`lib/net/draft.ts`) y cola del intento en el aparato. Aplicado a la entrega, al inicio del
  intento y al autosave; la evidencia ya reintentaba sola y sigue en silencio.
- **E2 — Player y `/aprender`** — **hecha el 23/9**: modo tarea (`TaskMode` + `TaskBar`
  en el player y el intento: la barra global se va en el teléfono), rail de 15 rem plegable
  en escritorio (`RouteRailFrame`), `/aprender` con selector de matrícula en la tarjeta
  (solo con ≥ 2; la lista «Tus otros programas» se va) y ruta resumida (abierto el módulo
  por el que se va). Sigue en confianza media hasta verlo a 360 px reales.
- **E3 — Examen y resultados** — **hecha el 23/9**: «Tienes un intento en curso. Cuando lo
  entregues, habrás usado tu único intento» (o «te quedarán N más») en «Qué esperar» y en el
  texto de la tarjeta; `/resultados` con una tarjeta por examen y una frase de situación
  (bloqueado y por qué, pendiente y hasta cuándo, en curso, «se conserva tu mejor intento de
  N: 82 %. Aprobado», entregado sin nota visible y por qué), una acción por tarjeta.
- **E4 — Cuenta y notificaciones** — **hecha el 23/9**: `AccountSummary` dice la cuenta en
  una frase («Tienes una cuota vencida desde el 18 de septiembre: te faltan $ 200.000»); la
  consecuencia solo para el adulto y con la política activa; al menor «El acceso a las clases
  nunca depende de los pagos» y sin rama que junte deuda y acceso. Avisos con un verbo por
  tipo y agrupados por día. Falta ver `/familia/[id]` con sesión de acudiente.
- **E5 — Calendario** — **hecha el 23/9**: «Hoy» / «Próximos 7 días» / «Después», distancia
  en cada fila («en 8 días», «hace 3 días»), una acción por fila («Unirse», «Abrir el
  examen»), fin de acceso una sola vez arriba con distancia y año. Las cuotas quedan fuera
  del calendario (decisión de producto pendiente).
- **E6 — Biblioteca** — **hecha (mínima) el 23/9**: una acción con nombre por fila
  («Descargar», «Ver la grabación») y filtro por tipo que solo aparece desde diez recursos
  (`?tipo=`, sin JavaScript). Sin buscador hasta tener contenido real. Sin verificar en
  Chrome (la extensión no cargó la ruta).

Antes de E2 y E3: ver la transcripción desplegada, una entrega con archivo y una pasada a
360 px real (un teléfono o DevTools; Chrome de escritorio no baja de 500).

## 4. Lo que la opinión añadió y se adopta como regla

- Las tres preguntas (§0) como criterio de cada pantalla.
- «No lo vimos» se escribe; no se completa imaginando. Se mantiene la tabla §1.
- La columna Confianza en toda decisión futura de UX.
