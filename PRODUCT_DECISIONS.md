# Product Decisions

Decisiones cerradas. No se reabren sin información nueva significativa.
Las marcadas **PROPUESTA** las decide Jhonny; están aquí para que la discusión tenga un texto.

---

## 2026-09-09 — Stack: el de don-pepo, sin mobile

**Decisión**: Next.js 15 App Router + TypeScript strict, Supabase (Postgres, Auth, Storage),
Prisma, Radix + Tailwind con tokens propios, TanStack Query, Jest + Playwright, Storybook,
next-intl. Vercel. pnpm + turbo. Sin app móvil: PWA responsive.

**Razón**: la doctrina, el tooling y la memoria muscular ya existen y están probados.

## 2026-09-09 — Sin pasarela de pago en el MVP — **SUPERADA el 14/9**

**Decisión original**: `Payment` con método `TRANSFER | BRE_B | CASH | GATEWAY`; operaciones
confirma los pagos manuales contra el extracto. Pasarela en fase 2, solo si se pide.

**Superada** por "Paridad con la propuesta competidora" (más abajo): Wompi entra al MVP.
Lo que se conserva: transferencia y Bre-B siguen siendo el camino sin comisión y la
plataforma sigue siendo de conciliación, no de recaudo.

**Razón**: Wompi cobra 2,65 % + $700 + IVA por transacción; transferencia y Bre-B cuestan
cero. El trabajo de la plataforma es la conciliación, no el recaudo.

## 2026-09-09 — El PIAR es una entidad ejecutable, no un archivo

**Decisión**: `Accommodation` por matrícula; el motor de evaluaciones la aplica; el intento
congela una copia. Nunca guarda diagnóstico.

## 2026-09-14 — Prisma + capacidades en TypeScript; RLS como defensa en profundidad

**Decisión**: acceso a datos vía Prisma desde el servidor de Next, con un cliente extendido
que inyecta `institutionId`. Autorización en `packages/domain/src/capabilities.ts`. RLS
activo con políticas que deniegan todo a `anon`/`authenticated`.

**Alternativa descartada**: "Supabase puro" (SQL migrations + supabase-js + RLS como
autorización). Válida, con menos capas; descartada porque las reglas del dominio no se
expresan como políticas de fila y acabarían en TypeScript de todas formas.

**Costo asumido**: el aislamiento por institución depende del cliente extendido y de un
test de integración por tabla.

## 2026-09-14 — `LearningEvent` desde el día 1

Tabla append-only con cada acción del estudiante. Sin consumidor en el MVP. Cuesta un
`insert`; sin ella no hay pasado que analizar. Adoptada de la propuesta externa del 14/9.

## 2026-09-14 — El cliente es Valida YA: programa en cohortes, no colegio

**Decisión**: el modelo es `Institution → Program → Module → Cohort → Enrollment`. No hay
grados, grupos ni año lectivo. La cohorte es la unidad comercial y académica; puede
pertenecer a un aliado (B2B).

**Razón**: el análisis de validaya.com (`docs/analisis-validaya-learndash.md`) muestra un
bachillerato acelerado en cohortes de ~6 meses, varias al año, con aliados, 100 inscritos
activos y sin rol de profesor. Corrige el modelo K-12 del 9-14/9, que partió de la palabra
"colegio" sin verificar.

**Consecuencia asumida**: la propuesta externa del 14/9 tenía razón en `Cohort` y se había
descartado por error.

## 2026-09-14 — Multitenancy por institución desde el día 1

**Decisión**: `Institution` como raíz de tenancy en todas las tablas, aunque el primer y
único cliente sea Valida YA.

**Razón**: el plan es ofrecer el sistema a otras entidades que hagan lo mismo en otro
lugar. Añadir el tenant después toca cada tabla y cada consulta.

## 2026-09-14 — Video en Vimeo; Mux fuera

**Decisión**: `MediaAsset.provider = VIMEO` es el proveedor del MVP. Se conservan los ids
actuales. La abstracción de proveedor se mantiene.

**Razón**: 130 de 220 temas ya tienen video en Vimeo y ningún archivo de video vive en
WordPress. Vimeo ya da streaming adaptativo, subtítulos y restricción por dominio.
Corrige "un colegio no es una plataforma de video" del 14/9: aquí el video es central.

## 2026-09-14 — El contenido es Markdown

**Decisión**: `LessonVersion.content` es Markdown (CommonMark + GFM + directivas
`::video`, `::audio`, `::pdf`), con recursos referenciados por `asset:<id>`. El editor
soporta pegar imágenes al estilo GitHub (sube, crea `MediaAsset`, inserta, pide `alt`).

**Razón**: texto plano, portable, diffable, destino natural del OCR, render semántico
limpio para lectores de pantalla. El editor es una capa; el formato no depende de él.
Reemplaza la decisión anterior de JSON de Tiptap para lecciones (las evaluaciones siguen
en JSON validado).

## 2026-09-14 — Dos caminos para el contenido existente, un destino

**Decisión**: se soportan ambos. (1) Transcripción a Markdown estandarizado vía OCR con
revisión humana en el editor: es el destino. (2) PDF o imagen como **legado**, importado
con `MediaAsset.legacy = true` y publicado con `LessonVersion.legacyException` auditada y
con fecha de conversión: es el puente. La validación estricta aplica a todo contenido nuevo;
la excepción solo la puede crear el importador, nunca el editor.

**Razón**: 110 temas por curso son imágenes de páginas de PDF. Exigir transcripción antes
de migrar bloquearía el lanzamiento; migrar sin plan de conversión perpetuaría contenido
inaccesible. El puente tiene fecha y lista visible.

> **Superada el 18/9.** Sin importación no hay contenido existente: queda un solo camino,
> el (1), y la excepción salió del código y del schema. Ver las dos entradas del 18/9.

## 2026-09-14 — Mora: absoluta para menores, pendiente de asesoría para adultos

**Decisión**: para matrículas de menores, ningún flag de `RestrictionPolicy` toca el
acceso académico (SU-624/99, T-666/13). Para adultos, la suspensión de contenido por mora
**no existe como columna** hasta que un abogado confirme que procede; entonces se añadirá
`suspendContentAccessForAdults`, solo para `isMinorAtEnrollment = false`, con acuerdo de
pago ofrecido antes y auditoría. `RestrictionPolicy` se conserva con sus flags no
académicos y `PaymentAgreement` como estado de primera clase.

**Razón**: la jurisprudencia que fundamentó "nunca" protege a menores en colegios; para
adultos en un programa privado la relación es más contractual, pero no está verificado.

## 2026-09-14 — Progreso con evidencia

**Decisión**: `COMPLETED` lo decide `lesson-completion.ts` con `LessonProgress.evidence`
según la forma del contenido (video al 90 % o transcripción leída; Markdown hasta el final
con tiempo mínimo; legado visto con tiempo mínimo), no un botón. `source` distingue
`EVIDENCE`, `IMPORTED` y `MANUAL` (operaciones, con motivo y auditoría).

**Razón**: el "30 % completado" de LearnDash es cuántos pulsaron "marcar como completado".
No significa nada para un aliado ni para el estudiante.

> **Corregida el 18/9.** La forma "legado" ya no existe: `LessonForm` es `VIDEO`,
> `MARKDOWN` o `SUBMISSION`.

## 2026-09-14 — Preguntas como JSON versionado, no como tablas

Ver `reference/04-business-logic/contenido-y-evaluaciones.md`. Deliberado.

## 2026-09-14 — Fuera del MVP, explícitamente

Realtime, IA (tutor, generación de quizzes, pgvector), gamificación, competencias/DBA como
motor (queda `learningObjective` como texto), certificados verificables, contrato de aliado
que agrupe cuotas, varias sedes, app móvil, pasarela, DIAN, Mux.

Ninguna requiere cambiar el modelo para entrar después.

**Gamificación** queda fuera indefinidamente: premiar clics con XP es lo contrario de lo
que un programa de bachillerato le pediría a la plataforma.

(Actualizado 14/9: certificados, sesiones en vivo, entregas y pasarela **entran** al MVP
por paridad con la propuesta competidora. `open_text` sigue fuera: la entrega de actividad
lo cubre.)

## 2026-09-14 — Auditoría de fase 0: 48 hallazgos, 41 aplicados

Tres paneles (PO+CMO, CTO+arquitectura+BD, UX+a11y) revisaron todo. Lo aplicado y lo
descartado, con motivo, en `docs/auditoria-fase0.md`. Las decisiones que cambiaron el
modelo:

- **`institutionId` en todas las tablas**, también en las hijas (aislamiento verificable
  por tabla). FK compuestas por tenant quedan para endurecimiento.
- **La asignación es (cohorte, tema)**; la versión asignada puede cambiar (auditado) y el
  progreso recuerda con qué versión se recogió. `invalidatesProgress` reabre un tema solo
  cuando el autor lo marca.
- **Las reglas del intento viven en `AssessmentVersion`** (`maxAttempts`, `timeLimitMinutes`,
  `passPercent`, `reviewPolicy`), no en el contenedor.
- **`answerKey` separado** y excluido del cliente Prisma por defecto.
- **Cuotas de acuerdo como `Installment`**, no JSON; `Payment` se anula, no se borra.
- **Capacidades con alcance** (`Map<Capability, Scope[]>`); test "misma institución, otra
  cohorte → 403" por endpoint.
- **Estados por tiempo derivados** + un job diario (Vercel Cron); sin colas.
- **Recuperación de contraseña, reinvitación, flujo de invitación con consentimiento.**
- **Contenido**: LaTeX (`$…$`) y `:lang[]{}` en el contrato; `captionsSource` distingue
  subtítulos automáticos de revisados; `LessonVersionAsset` une versión y recursos.
- **Secuencia y aprobación** definidas: evaluaciones después de sus temas; en `LINEAR`
  bloquean el módulo siguiente; `DIAGNOSTIC` primero y no cuenta.
- **Intento vencido con respuestas guardadas se entrega y califica**; `EXPIRED` solo sin respuestas.
- **Marca por institución** (`Institution` con logo, color, contacto, política de datos,
  dominio); el remitente de correo ya no es una variable de entorno.
- **Importación idempotente** (`sourceRef`, `ImportRun`); fuente = dump SQL + WXR.
- **Retirados**: `hideOptionalActivities` (sin `Lesson.isOptional`) y `simplifiedContent`
  (sin variante). Un flag sin efecto engaña.
- **`open_text`** (calificación manual) fuera del MVP: la muestra es 100 % respuesta única.
- **Staging y prod desde la fase 1**, migraciones por CI, Sentry desde el primer handler.
- **Centro de notificaciones en el MVP**: el correo de muchos migrados no es fiable.

## 2026-09-14 — Las 11 decisiones de la auditoría, cerradas por Jhonny

| #   | Decisión                                                                          | Consecuencia                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Corte con LearnDash: solo cohortes nuevas.** Las en curso terminan en LearnDash | El importador migra **contenido** (programa, módulos, temas, videos, evaluaciones, preguntas), no personas ni progreso. Las personas de la primera cohorte nueva entran por CSV. `ProgressSource.IMPORTED` queda para un futuro; hoy no se usa    |
| 2   | `accessUntil` de migrados: no aplica                                              | Sin matrículas migradas                                                                                                                                                                                                                           |
| 3   | **Dominio propio por cliente** desde el MVP                                       | `Institution.primaryDomain` obligatorio en la práctica; `middleware.ts` resuelve el tenant por host; alta en Vercel y en la lista de embeds de Vimeo por cliente. Sin subdominios de `colombiaestudia.co` por ahora                               |
| 4   | Marca: solo "Colombia Estudia" por ahora                                          | Sin verificación en la SIC por ahora; marca blanca por institución igual (`Institution` con logo, color, remitente)                                                                                                                               |
| 5   | **Legado: "texto automático"**                                                    | El borrador OCR sin revisar se muestra como alternativa textual con el aviso "Texto generado automáticamente; puede contener errores", para lectores de pantalla y búsqueda. La revisión humana sigue siendo el destino                           |
| 6   | Subtítulos: nadie por ahora                                                       | Los videos migrados publican bajo la excepción de legado con `captionsSource AUTO` o `NONE`. La regla estricta aplica a videos nuevos. Un estudiante con `requiresCaptions` ve el aviso y "Pedir versión accesible"                               |
| 7   | **`/familia` fuera del MVP**                                                      | Sin login de acudiente. Si hay un menor en una cohorte, el consentimiento lo firma el acudiente **en papel** y operaciones lo registra (`Consent.channel = PAPER`); `Guardianship` se registra igual. La regla de mora para menores sigue intacta |
| 8   | `PARTNER_PAID` en UI: "una entidad aliada"                                        | Glosario actualizado; no se nombra al aliado al estudiante                                                                                                                                                                                        |
| 9   | Backups: **Supabase Pro basta** (diarios, 7 días)                                 | Sin PITR. Restauración probada en fase 6                                                                                                                                                                                                          |
| 10  | Suspensión de acceso a adultos por mora: después                                  | Sigue sin columna                                                                                                                                                                                                                                 |
| 11  | Plan de Vimeo: después                                                            | Pendiente antes de la salida a producción: restricción de embed por dominio                                                                                                                                                                       |

## 2026-09-14 — Paridad con la propuesta competidora (Zona 57) y por encima

Valida YA recibió una propuesta de un LMS en WordPress (Zona 57, 16 semanas). Se decidió
por nosotros; el compromiso es **dar lo mismo y mejor**. Lo que esa propuesta incluía y el
MVP no tenía, entra al MVP:

| Ofrecían                                            | Entra como                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clases en vivo (Zoom u otra)                        | `LiveSession`: enlace, fecha, recordatorio, grabación como recurso. Sin API de videoconferencia                                                                                      |
| Certificados automáticos por módulo y diploma final | `Certificate` (`MODULE`, `PROGRAM`) con código público verificable en `/certificado/[code]`. Constancia de finalización, no el título de bachiller. **Nunca condicionada a cartera** |
| Entregables prácticos                               | `Submission`: texto y/o archivo por tema `requiresSubmission`, revisión por instructor, `APPROVED` completa el tema. Es lo que los temas "ACTIVIDAD" necesitaban                     |
| Pasarela de pagos (tarjeta, débito, PSE)            | Wompi checkout + webhook idempotente (`Payment.gatewayRef`). Transferencia y Bre-B siguen siendo gratis; el estudiante elige                                                         |
| Calendario académico                                | `/aprender/calendario`: fechas de cohorte, `dueAt`, sesiones en vivo                                                                                                                 |
| Biblioteca digital y recursos descargables          | `/aprender/biblioteca`: recursos por módulo desde `LessonVersionAsset`                                                                                                               |
| Sitio institucional (Home, Nosotros, FAQ…)          | **No lo construimos**: validaya.com sigue en WordPress como sitio público sin LearnDash; la plataforma vive en su propio dominio                                                     |
| Correos automáticos, recordatorios                  | Ya estaba: job diario + centro de notificaciones + Resend                                                                                                                            |
| Paneles por rol, reportes, seguimiento              | Ya estaba, con evidencia real y exportación                                                                                                                                          |

Lo que ellos no ofrecían y nosotros sí: accesibilidad AA validada en el contenido, PIAR
ejecutable, una fuente / N cohortes sin clonar, cartera con acuerdos y jurisprudencia,
contenido en Markdown portable (sin lock-in de plugins), auditoría, aislamiento
multitenant. Ver `docs/propuesta-comercial-validaya.md`.

## 2026-09-14 — Accesibilidad: WCAG 2.2 AA y tres principios propios

**Decisión**: el objetivo pasa de 2.1 AA a **2.2 AA** (superconjunto; cumple la Resolución
MinTIC 1519). Se adoptan tres principios por encima de WCAG (todo video con alternativa
textual; toda actividad completable sin ratón, color, sonido ni tiempo estándar; la
accesibilidad nunca impide medir el aprendizaje), un módulo `apps/web/lib/a11y/` como SSOT
de anuncios, foco y preferencias, transcripción sincronizada (WebVTT), preferencias de
lectura por persona, y Definition of Done con accesibilidad.

**Razón**: revisión de una propuesta externa de accesibilidad (14/9). Se descartó de ella
el marco europeo (EAA, EN 301 549, RGAA: no aplican en Colombia) y el modelo de ajustes por
evaluación (el nuestro, por matrícula, es el correcto para el PIAR).

## 2026-09-14 — PROPUESTA: modelo comercial

Valida YA como socio de diseño: implementación reducida + licencia mensual, propiedad
intelectual 100 % nuestra por contrato. Referencias de mercado: un LMS por estudiante
activo para la parte de aprendizaje, y Q10 Básico ($920 k + $4 k/estudiante al mes) solo
como comparable de la parte administrativa —no es competidor de un programa en cohortes.
Propuesta de valor en `docs/propuesta-de-valor.md`. Lo decide Jhonny y lo revisa un
abogado antes de firmar nada.

## 2026-09-16 — Un solo tenant fijo en el primer alcance

**Decisión**: hasta tener el producto completo, la aplicación sirve una única institución,
`Institution.slug = colombia-estudia`, fijada en código (`apps/web/lib/authz/tenant.ts`). La
resolución del tenant por host (`Institution.primaryDomain`, decisión #3 de la tabla de
arriba) queda implementada en el middleware pero aplazada hasta la segunda institución.

**Consecuencia**: `getRequestContext()` resuelve por slug; el script de §10 crea esa
institución con ese slug; en desarrollo local no hace falta dominio ni override. `primaryDomain`
sigue siendo obligatorio en el schema y se rellena con el dominio de staging.

## 2026-09-16 — Alcance del MVP: happy paths de negocio, externos detrás de interfaces

**Decisión**: el MVP no exige cerrar las integraciones externas (Resend, Wompi, Vimeo,
Sentry en producción); exige los caminos felices de negocio funcionando de punta a punta.
Cada integración se implementa detrás de una interfaz con un adaptador local (consola,
stub) que permite recorrer el flujo sin la cuenta externa, y el adaptador real se conecta
cuando existe la credencial.

**Consecuencia**: `lib/mail` con `ConsoleMailer` hasta tener `RESEND_API_KEY`; el enlace de
invitación no se expone en la UI de operaciones (quien lo tenga puede fijar la contraseña del
estudiante y firmar la política en su nombre): en local y staging se lee en los logs.

## 2026-09-17 — Tipografía: una sola webfont, Atkinson Hyperlegible Next

**Decisión**: el producto usa una única familia, Atkinson Hyperlegible Next, self-hosted
con `next/font/local` desde `apps/web/app/fonts/`. Esto **revierte** la línea "fuentes del
sistema (sin webfonts en el MVP)" de `plan/11-ux.md`, que queda corregida.

Descartadas por el camino:

- **Plus Jakarta Sans para títulos + Lexend para el resto** (propuesta inicial). Dos
  geométrico-humanistas contemporáneas no dan contraste real: la jerarquía ya la carga el
  sistema de roles por peso y tamaño. Material admite una segunda familia solo para
  `display`, pero en web el `h1` de display suele ser el elemento LCP, que es el peor sitio
  posible para una segunda descarga.
- **Lexend sola**. Bloqueada por un hecho técnico: el fichero variable de Lexend **no trae
  la feature OpenType `tnum`** y sus dígitos son proporcionales (el `0` mide 607 unidades y
  el `1` mide 500 sobre un em de 1000; la diferencia crece con el peso). Eso convierte
  `font-variant-numeric: tabular-nums` de `.type-data` en una instrucción muerta y rompe la
  alineación de notas, cuotas y el cronómetro —sin que nada falle ni avise. Además, su
  fichero variable solo tiene el eje `wght`: el eje de anchura sobre el que se construye
  toda la investigación de legibilidad de Lexend ni siquiera está presente.

**Por qué Atkinson Hyperlegible Next**: trae `tnum` y sustituye los diez dígitos por un
juego de 632 unidades constante en 400, 600 y 700 (verificado con fontTools). Pesa 20,1 KB
en woff2 tras recortar el eje `wght` a 400–700 y subsetear al rango `latin`. Y su tesis de
legibilidad —desambiguar caracteres parecidos (I/l/1, O/0, b/d), diseñada por el Braille
Institute para baja visión— es una propiedad que se comprueba mirando, no un estudio de
velocidad de lectura sin replicación independiente.

**No se afirma** en ningún material comercial que la fuente "aumenta la velocidad de
lectura". Esa afirmación no es sostenible con la evidencia pública y no la vamos a hacer.

**Consecuencias**:

- El eje de familia pasa a estar tokenizado (`fontFamily.sans` en el plugin de
  design-tokens, alimentado por `--font-sans`). Hasta hoy la app heredaba en silencio el
  stack por defecto de Tailwind: cumplía "sin webfonts" por accidente, no por contrato.
- Sin cursiva: Google Fonts no publica un variable italic de esta familia y un segundo
  fichero duplicaría el peso. El navegador sintetiza la oblicua hasta que se revise en
  Fase 3, con el renderizado de contenido.
- Antes de adoptar cualquier otra fuente hay que comprobar `tnum`. El procedimiento está
  en `apps/web/app/fonts/README.md`.
- Queda por medir el LCP en staging contra el presupuesto de 2,5 s en 4G lento
  (`plan/10-endurecer-y-lanzar.md`). Si no pasa, se revierte a fuentes del sistema.

## 2026-09-17 — Vimeo: se guarda el id y no el hash de privacidad

**Decisión**: `MediaAsset.providerRef` guarda **solo el id numérico** del video. El hash de
privacidad de un video no listado (`vimeo.com/{id}/{hash}`, `?h={hash}`) se reconoce al
pegarlo pero **no se almacena**.

Es la opción A de las tres que se plantearon; las otras eran guardar `"{id}:{hash}"` en el
mismo campo (sin migración, pero `providerRef` dejaría de ser "el id" y todo el que lo lea
tendría que partirlo) o añadir una columna opcional (limpia, con migración).

**Por qué se sostiene**: el contrato ya lo daba por hecho —
`reference/06-external-integrations/README.md:22-24` dice que el embed se protege
**restringiendo el dominio** en Vimeo, es decir, que el id basta para reproducir. Guardar el
hash no añadiría seguridad; solo haría falta si los videos fueran no listados.

**Qué la invalida**: que los videos de Valida YA resulten ser **no listados**. En ese caso el
reproductor no monta el video con el id solo, y hay que pasar a la opción de la columna.

**Cómo se detecta antes de que duela**: `registerVimeoVideo` devuelve `unlisted: boolean` —
verdadero cuando lo que se pegó traía hash. La pantalla del editor (§3) tiene que
**enseñarlo** al registrar el video, no tragárselo: es la única señal de que este supuesto no
se sostiene, y el sitio donde se descubriría sin ella es el reproductor en blanco, en la
Fase 4.

**Pendiente heredado del contrato**: verificar que el plan de Vimeo permita restringir el
embed por dominio y añadir el dominio de cada institución. Sin eso, quien conozca el id
reproduce el video — y con la opción A eso es toda la protección que hay.

## 2026-09-18 — La navegación del staff pasa a una columna lateral

**Decisión**: el área de staff y la de admin usan `SideNav`. **Revierte la decisión escrita en
`AppHeader.tsx:4-7`** («a calm bar and nothing else — no sidebar, no hamburger»).

**Por qué aquella era correcta**: con cuatro destinos una barra superior es toda la
navegación, refluye a 320 px con solo `wrap`, y no necesita JavaScript, así que no se puede
romper. Sigue siendo verdad hoy: `staff-nav.ts` tiene cuatro entradas.

**Por qué cambia igual**: `app/(staff)/layout.tsx:2` ya nombra aliados, cartera e inclusión.
Con siete destinos más notificaciones y cerrar sesión, la barra se parte en dos líneas y deja
de ser una barra. La decisión se toma ahora para no rehacer cada pantalla cuando entre el
quinto.

**Lo que costaba y se paga**: en el teléfono la navegación queda detrás de un botón, que es
peor que verla. El cajón es `@radix-ui/react-dialog` y no uno escrito a mano, para no perder
lo que el patrón APG exige —foco atrapado, `Escape` cierra, el foco vuelve al disparador—, y
en escritorio la columna sigue siendo CSS sin JavaScript. `usePathname` ya obligaba a que la
navegación fuera cliente antes de este cambio.

**Consecuencia**: `AppHeader` queda **retirado**, no borrado (`DESIGN.md` §Reglas de proceso).
`lib/nav/staff-nav.ts` renombra su tipo `NavItem` a `NavDestination`, porque el componente que
lo pinta se llama `NavItem` y un archivo no podía usar los dos. `Page` pasa de `max-w-5xl` a
`max-w-content` (72rem): con la navegación al lado, el marco estrecho dejaba un pasillo vacío.

## 2026-09-19 — Un vídeo sin subtítulos ni transcripción avisa, pero no impide publicar

**Decisión** (Jhonny): `video-needs-captions` y `audio-needs-captions` pasan de **error** a
**aviso** en `packages/domain/src/publish-validation.ts`. Un tema con un vídeo sin subtítulos
revisados ni transcripción se puede publicar. La regla sigue corriendo y sigue diciendo qué
falta; la tarjeta del vídeo en el editor lo enseña («Sin subtítulos ni transcripción») y el
diálogo de publicar lo cuenta («con 1 aviso que no impide publicar»).

**Lo que cuesta, dicho claro**: es la única regla de accesibilidad del contrato que no
bloquea. WCAG 2.2 exige subtítulos para vídeo pregrabado en el nivel A (1.2.2), y un
estudiante que no oye no puede seguir ese tema hasta que alguien pegue la transcripción. El
gate de accesibilidad del CI (pa11y) mira la interfaz, no el contenido, así que esto no lo
detiene nada. La decisión del 18/9 («nada publica sin cumplirlas») queda revocada para esta
regla y solo para esta.

**Cómo se arregla un vídeo**: desde el engranaje de su bloque en el editor, que abre un
diálogo con la transcripción y la casilla «vi los subtítulos». La tarjeta «Videos y audios de
este tema» desaparece: la persona arregla el vídeo donde lo está mirando.

## 2026-09-19 — El editor de contenido es propio: bloques, sin `contenteditable`

**Decisión**: el área de edición de un tema es una lista de bloques —texto, sección, lista,
cita, vídeo, imagen, fórmula, tabla, código, separador— y cada bloque de texto es un campo
nativo (`<textarea>`, `<input>`) que crece con lo escrito. Sin `contenteditable`, sin Tiptap,
sin dependencias nuevas. `features/content/editor/blocks.ts` y `BlockEditor.tsx`.

**Se descartó Tiptap el mismo día**, tras tenerlo montado: Jhonny quiere el editor propio.
Un WYSIWYG escrito desde cero —selección, deshacer, pegado, IME, lector de pantalla, cada
navegador— es lo que ProseMirror tardó años en hacer bien y no se puede entregar con calidad;
un editor de bloques sobre controles nativos sí, porque todo eso lo pone el navegador.

**Se guarda Markdown**, como siempre. Y se **recorta, no se reconstruye**: `remark-parse` —el
del render— dice dónde empieza y acaba cada bloque, y el texto del bloque es ese trozo del
original. Abrir y cerrar sin tocar nada devuelve el Markdown byte a byte (probado). Negrita,
cursiva, enlace, otro idioma y fórmula en línea siguen siendo Markdown dentro del bloque, con
botones que lo escriben sobre lo seleccionado; quien lo sabe puede escribirlo a mano.

**Qué aporta que el textarea único no**: pegar la dirección de un vídeo de Vimeo en un
texto vacío lo convierte en bloque de vídeo, con el reproductor y su estado («impide
publicar») dentro; Intro abre un bloque, Retroceso en uno vacío lo quita, las flechas lo
mueven; una lista continúa su marcador al pulsar Intro; el aviso lleva al bloque; secciones,
vídeos, imágenes, fórmulas y tablas sin saber su sintaxis.

**Qué no hace, a propósito**: pintar la negrita como negrita dentro del campo (es un
`textarea`; la vista previa la pinta), subrayado y colores (el Markdown no los tiene), `h1`
(es el título del tema), y anidar listas desde botones (se escribe con sangría; se conserva).

**Consecuencia**: las siete dependencias `@tiptap/*` que estaban instaladas y sin usar
sobran. `plan/07-contenido-y-migracion.md:28` y `routes.md:49` quedan corregidos. El panel de
avisos sigue viniendo del servidor sobre lo guardado (una sola verdad).

## 2026-09-19 — El manual de marca entra al producto donde se puede ver, y solo ahí

**Decisión** (Jhonny, 19/9): el acento del tema claro pasa a ser el Azul Principal del manual,
`#0047BA`, y con él se mueven `text.link`, `status.info` y `focus.ring` (`#0D2E6E`, el Azul
Oscuro); el lienzo pasa al Gris Claro `#F3F5F8`. Sustituye al `#123B7A` del 18/9. El tema
oscuro **no** adopta el hex del manual, la tipografía **sigue siendo Atkinson** (17/9) y el
amarillo entra solo como `brand.yellow` decorativo.

**Razón**: `#0047BA` pasa AA sobre blanco con 8.04:1, pero sobre el lienzo oscuro da 2.33:1;
copiar el hex al tema oscuro sería cumplir el PDF y romper el producto. `#8FB6F0` es el mismo
tono a otra luminosidad, que es como un azul de marca vive en oscuro. El amarillo da 1.64
sobre blanco: no puede ser texto, icono ni anillo de foco, y como botón dentro de la app se
leería como aviso porque `warning.muted` y `surface.note` ya son de esa familia. El rojo del
manual (`#D72638`) sobre `error.muted` daría 4.20 y fallaría el contrato; el `#BE1D1D` se queda.

**Corrección propia**: en la propuesta inicial se dijo que el anillo de foco «sería invisible
sobre los botones primarios» y que debía pasar al amarillo. Falso en los dos puntos: el anillo
lleva `outline-offset: 3px` y va sobre la superficie, no sobre el botón (por eso el contrato
mide anillo / superficies, `contract/pairs.ts`), y el amarillo fallaba los cuatro pares.

**Contrato**: 36 pares × 2 temas, 0 fallos; holgura mínima +0.53 en claro, +1.22 en oscuro.
Detalle en `reference/03-ui/tokens.md` § Marca.

## 2026-09-19 — La portada `/` es pública y no promete nada que no exista

**Decisión** (Jhonny, 19/9): `/` deja de redirigir a nadie. Con o sin sesión muestra la web
pública de la marca (`features/marketing/landing.tsx`); con sesión el botón de la cabecera
dice «Ingresar» y lleva a `/ingresar`, la ruta nueva que elige el área por rol
(`lib/authz/home.ts`) y que es el destino por defecto tras iniciar sesión (`HOME_AFTER_LOGIN`).
Programas con textos fijos por ahora (una tarjeta: bachillerato acelerado); CTA principal
«Escríbenos por WhatsApp» (`Institution.supportPhone`; si no hay, `mailto:` al
`supportEmail`), «Iniciar sesión» secundario en la cabecera.

**Razón**: no hay auto-registro (routes.md), así que un «Regístrate» sería mentira; la
matrícula empieza con una conversación y la portada lo dice. Las cifras del mockup del manual
(«+10.000 estudiantes») no están porque no las tenemos. Lo que la portada promete —cohortes,
vídeo con transcripción, evaluaciones con retroalimentación, ajustes de lectura, WCAG 2.2 AA
en CI— es lo que la plataforma hace. El contacto sale de la institución, no de variables de
entorno; para eso `institution-cache` lee también `dataPolicyUrl` (pie de página, Ley 1581).

**Pendiente**: el logo (hoy el nombre va como texto en el color del acento) y los programas
reales desde la base cuando haya más de uno con descripción.

## 2026-09-19 — La portada toma la composición del mockup, no su modelo de negocio

**Decisión** (Jhonny, 19/9): la web pública se construye sobre la referencia visual
`docs/brand/landing-reference.png` (hero editorial con la persona sobre las formas de marca,
barra flotante bajo el hero, tarjetas compactas de programa, panel editorial, tres pasos,
banner azul, CTA final con foto, pie pequeño), con el producto real dentro: cohortes, contacto
por WhatsApp o correo, sin registro. Fuera hasta que existan: cifras de impacto, testimonios,
instituciones o partners, buscador, "Para empresas", "Crear cuenta". Fotografías: solo las que
entregue el cliente (`features/marketing/media.ts`); mientras tanto, huecos con aspecto fijo.

**Razón**: el mockup es un marketplace de cursos con auto-registro y cifras que no tenemos;
copiar su estructura dejaría cinco secciones en estado vacío el día del lanzamiento y un paso
1 ("Crea tu cuenta, es gratis") que no es verdad. La composición sí vale: es el manual.

**Lo que no entra del prompt que acompañaba al mockup**: Lexend (Atkinson se queda, 17/9); su
paleta (`#0053A6`, grises _slate_ de Tailwind: cuarto azul de marca y grises genéricos, contra
`tokens.md`); su árbol de componentes (`components/home`), que choca con el diseño atómico y
`lint:arch`; los assets `ce-*.svg`, que no existen. Se adopta: el contrato de imágenes, la capa
de datos, la fidelidad con excepciones documentadas, y el resto de sus reglas de accesibilidad
y rendimiento, que ya eran las del repo.

**Desviaciones respecto a la referencia, y por qué**: la barra flotante lleva hechos y no
cifras (no hay cifras); un solo programa en una rejilla de cuatro (es lo que hay; la rejilla no
cambia cuando haya más); las anclas de la cabecera se ocultan en el teléfono en vez de un cajón
(cuatro anclas no justifican JavaScript); siempre en claro (`theme-light-scope`), porque la
web pública es blanca por manual y la foto manda.

## 2026-09-19 — La web pública tiene piel propia y no sigue el sistema al pie de la letra

**Decisión** (Jhonny, 19/9): la portada es la presentación ante un posible alumno y se diseña
para eso, con estilos propios: `features/marketing/site.css` bajo `.site` (paleta del manual,
Lexend 400/500/700 vía `next/font/google`, escala de marketing —hero hasta 72 px—, radios de
10/14/24, sombras difusas, botones propios), formas de marca en tres piezas SVG, chips con
hechos sobre la foto del hero, sección de preguntas frecuentes, botón flotante con la
invitación a escribir y aparición discreta al hacer scroll. El producto no cambia: Atkinson y
sus tokens siguen intactos; `Button` pierde la variante `brand` y el plugin `type-hero` /
`type-site-heading`, que solo existían para la portada anterior.

**Lo que se conserva del sistema**: contraste AA (medidos en `site.css`), el `:focus-visible`
global (`theme-light-scope` fija `--focus-ring`), objetivos de 44 px, HTML semántico, sin
registro, sin cifras, sin testimonios ni partners, fotos por contrato (`media.ts`).

**Preguntas frecuentes**: redactadas a partir de validaya.com/preguntas-frecuentes con
nuestras palabras (Decreto 3011, cohortes cada seis meses, 16 años al graduarse, 5.º de
primaria, 100 % virtual, ICFES no requerido, diploma físico). El precio se remite al contacto:
la web muestra «$ 90.000» tachando «$ 120.000» sin decir a qué corresponde, y no se afirma lo
que no se entiende. Los nombres de las entidades aliadas de Valida YA no se citan.

**Detalle técnico que costó**: el tema de colores de Tailwind está sobrescrito por los tokens,
así que `text-white` y `bg-white` no existen; la piel usa `.site-on-dark` y `bg-[#fff]`. Y
`hidden` no puede ir en un `.site-btn`: site.css fija `display` después de las utilidades.

## 2026-09-19 — El panel toma la composición del mockup administrativo, sin su producto

**Decisión** (Jhonny, 19/9): del mockup de panel (referencia: marketplace multi-institución)
se adopta lo que mejora la operación y cabe en el sistema que ya existe: migas y descripción
bajo el título; fila de indicadores **con el número actual y nada más** (sin «+12 % vs. mes
anterior» hasta que AuditLog tenga histórico); filtros con chips de lo aplicado y «Limpiar
filtros» (todo enlaces: la URL sigue siendo el estado); tabla con selección múltiple y acción
en lote, menú de acciones por fila, orden y tamaño de página en la URL, paginación numerada;
carril lateral en pantallas anchas (`xl`) con lo urgente (invitaciones que vencen en 7 días) y
lo reciente (AuditLog, sin `pii_read`, que taparía todo); avatar de iniciales, nunca fotos.
Piloto en `/personas`; se extiende a Cohortes y Contenido con las mismas piezas
(`molecules/breadcrumb`, `stat-card`, `filter-chips`, `row-selection`; `Page wide`;
`DataTable` con cabeceras nodo y columnas estrechas).

**No se adopta**: instituciones/convenios/solicitudes/roles y permisos (no existen en el
dominio: un tenant por institución), el anillo de distribución por rol (cuatro números que
ya están en la tabla), la tarjeta de ayuda (ya hay ayuda contextual flotante), filas de ocho
con foto (nuestras filas de 48 px caben veinte), el buscador global ⌘K (encargo aparte: hace
falta un endpoint que busque personas y cohortes a la vez).

**Razón**: la composición del mockup es la nuestra del 18/9 con más oficio; el producto que
describe no es el nuestro. Copiar la estructura de un marketplace en un tenant de cohortes
daría secciones vacías y un «Estado» de cuenta que no tenemos (lo que hay es invitación y
membresías).

## 2026-09-17 — El editor de contenido no usa CodeMirror

**Decisión**: el área de edición es un `<textarea>`. **Se descarta CodeMirror 6**, que el
plan nombraba (`plan/07-contenido-y-migracion.md:28`).

**Qué habría aportado**: resaltado de sintaxis del Markdown, autocompletado de directivas
(`::video{asset=…}`), numeración de líneas y salto directo a una línea desde el panel de
avisos.

**Por qué no compensa**: de esas cuatro, la que de verdad sirve —saltar a la línea del
aviso— ya funciona con `<textarea>`, moviendo el cursor y seleccionando esa línea. Las otras
tres son comodidad de programador, y quien escribe estos temas no lo es. A cambio entraban
seis paquetes, un componente que solo corre en el cliente, y trabajo de accesibilidad que un
`<textarea>` da gratis: CodeMirror captura el `Tab` y hay que devolverlo con `Escape` y
documentarlo en pantalla, que es exactamente el tipo de instrucción que nadie lee.

**Consecuencia**: `plan/07-contenido-y-migracion.md:28` queda corregido. Si algún día el
Markdown de los temas se vuelve lo bastante denso como para necesitar resaltado, esto se
revisa; hoy no lo es.

## 2026-09-17 — Una evaluación sin preguntas no se publica

**Decisión**: `validateAssessmentForPublish` rechaza `questions: []` con la regla
`questions-required`.

**Por qué**: una evaluación vacía pasaba todas las demás reglas —nada que duplicar, ninguna
clave que falte, ningún punto que no cuadre— y habría llegado a una cohorte como un examen en
blanco que califica 0/0. Lo encontré ejecutando el validador, no leyéndolo.

**Consecuencia**: es la primera regla de publicación que no viene de
`contenido-y-evaluaciones.md`. Queda anotada como tal en el código.

## 2026-09-18 — No se importa nada de LearnDash: todo el contenido es nuevo

**Decisión**: el programa se escribe desde cero en la plataforma. **No hay migración de
contenido desde LearnDash.**

**Qué deja de existir del plan**:

| Paso                                                                                                  | Estado                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `07-contenido-y-migracion.md` §7 — importador de LearnDash                                            | **Cancelado**                                                                                             |
| §8 — OCR de las imágenes de página del contenido migrado                                              | **Cancelado**: no hay imágenes de página que transcribir                                                  |
| §9 — `/contenido/legado`                                                                              | **Cancelado tal cual**: era la pantalla de las versiones con excepción de legado, y no va a haber ninguna |
| Decisión 6 del contrato ("nadie revisa subtítulos por ahora", los 130 videos publican bajo excepción) | **Sin efecto**: no hay 130 videos migrados                                                                |

**Qué gana el producto**: la excepción de legado existía para dejar publicar contenido que no
cumplía las reglas de accesibilidad porque ya existía. Sin migración, **ningún tema publica
sin cumplirlas**. Es una plataforma más estricta desde el primer día, y sin deuda que
convertir.

**Qué cuesta**: los 110 temas y las 7 evaluaciones hay que escribirlos. La plataforma no
puede lanzar con contenido que no tiene, y eso es trabajo de autoría, no de desarrollo. El
calendario de la fase 3 deja de estar limitado por el importador y pasa a estarlo por quien
escriba.

**Consecuencia inmediata, y era un agujero**: hasta hoy **no existía ninguna forma de crear
un tema ni una evaluación** — iban a entrar los 110 de golpe por el importador. Añadidos
`POST /api/content/lessons` y `POST /api/content/assessments`, con sus formularios.

**Lo que quedó sin tocar ese día**: los campos `legacyException`, `convertUntil` y
`MediaAsset.legacy` del schema, y las ramas de código que los miran. Se decidió aparte, el
mismo 18/9 — ver la entrada siguiente.

## 2026-09-18 — Se retira la excepción de legado del código y del schema

**Decisión** (Jhonny, sobre la pregunta que dejó abierta la entrada anterior): se quitan las
dos cosas, código **y** schema. La válvula que permitía publicar contenido que no cumple no
se conserva "por si acaso".

**Razón**: una excepción que nadie puede crear no es una válvula, es una rama muerta que hay
que seguir leyendo, probando y explicando en cada revisión. El importador era el único
servicio autorizado a escribir esos campos y no existe. Si algún día entra contenido de
otro sitio, la decisión de cómo dejarlo pasar se toma entonces, con ese contenido delante;
hoy solo sostiene reglas de validación con dos caminos donde debería haber uno.

**Qué se fue**:

| Dónde                                          | Qué                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/publish-validation.ts`    | `legacyException` sale de `ValidateLessonInput` y de todo el hilo. `video-needs-captions`, `audio-needs-captions`, `pdf-needs-text-alternative` y el `alt` de imagen pasan a `severity: 'error'` **siempre**: ya no hay entrada que los degrade a aviso |
| `packages/domain/src/lesson-completion.ts`     | `LessonForm` queda en `VIDEO \| MARKDOWN \| SUBMISSION`. `LEGACY` no tiene forma de existir                                                                                                                                                             |
| `packages/domain/src/metrics.ts`               | `legacyStatus` borrado                                                                                                                                                                                                                                  |
| `packages/types/src/content.ts`, `catalogs.ts` | `LessonAssetInfo.legacy`; `lesson_version` audita solo `published`; salen los tipos de aviso `convert_until_soon` y `accessible_ready`                                                                                                                  |
| `prisma/schema.prisma`                         | `LessonVersion.legacyException`, `LessonVersion.convertUntil`, `MediaAsset.legacy`. Los dos índices que los incluían se reducen a `[institutionId, status]` y `[institutionId, kind]`                                                                   |
| `apps/web`                                     | Las referencias en `lessons.service.ts`, la pantalla de contenido, el editor, la ruta de publicación y los mensajes                                                                                                                                     |

**Lo que NO se fue, y por qué**: el token `status.legacy` del sistema de diseño. Está en el
contrato de contraste (`packages/design-tokens/src/contract/pairs.ts`) y en la prueba que lo
verifica; quitarlo es una decisión de diseño, no de dominio, y hoy no cuesta nada tenerlo.
Queda sin consumidor y anotado como tal en `reference/03-ui/tokens.md`.

**La migración**: `prisma/migrations/20260918000000_drop_legacy_exception/`. Escrita, **no
aplicada**. La aplica CI contra remoto, como todas. No se pierde ningún dato: esas columnas
nunca se escribieron desde la aplicación.

**Lo que esto le hace a los documentos**: las entradas del 14/9 sobre los dos caminos y sobre
el progreso del legado quedan como registro de por qué existió aquello, no como descripción
del sistema. Lo mismo en `reference/`, donde lo retirado va tachado y fechado en vez de
borrado.

## 2026-09-19 — Fase 4: entregas e intentos, las decisiones que el plan no cerraba

**Contexto**: el mandato del 19/9 fue «continúa todo lo que está en el roadmap; audita al
final de cada fase y continúa». Al construir §2b (evidencia y entrega), §3 (intentos) y §4
(cola de entregas) de `plan/08` aparecieron huecos que el plan deja abiertos. Se decidió
así, y se cambia si Jhonny dice otra cosa:

1. **Una fila de `Submission` por (matrícula, tema); el reenvío la reescribe.** El schema
   no impide varias filas, pero «una por tema; reenvío tras RETURNED» (`endpoints.md:41`) se
   lee mejor como una sola. El comentario de la devolución anterior se conserva hasta la
   siguiente revisión, para que el revisor vea qué pidió. El rastro completo está en
   `LearningEvent lesson.submission.sent` y en `AuditLog submission.approved|returned`.
2. **La cola de entregas no tiene endpoint de detalle: la página es el detalle**
   (`/cohortes/[id]/entregas?entrega=<id>`). Así la notificación `submission_received`
   enlaza a una entrega concreta y todo llega en una petición, con la URL firmada del
   archivo generada en el servidor.
3. **`FULL_AFTER_DUE` sin `dueAt` se comporta como `FULL_AFTER_GRADED`.** No hay un
   «después de la fecha límite» que esperar; esperar para siempre sería no enseñar nunca.
4. **La revisión completa enseña, por pregunta, si fue correcta, los puntos y el
   `feedback` de la clave —no la respuesta correcta**. `answerKey` no sale del servicio en
   ningún caso (`attempt.service.ts` es el único que la lee, y solo al calificar). Si el
   equipo pedagógico quiere mostrar la opción correcta, es una decisión aparte que hay
   que tomar sabiendo que reduce la reutilización de las preguntas entre intentos.
5. **Un intento vencido se cierra en el primer request que lo encuentra** (pantalla
   previa, autosave, entrega o resultados), no solo en el job diario: con respuestas se
   califica; sin ninguna queda `EXPIRED` sin calificar (no cuenta como aprobado ni
   reprobado, pero sí gasta el intento). El job de la Fase 5 hará lo mismo con los que
   nadie vuelva a abrir.
6. **Empezar es idempotente**: si hay un intento `IN_PROGRESS`, «Empezar» lo devuelve en
   vez de crear otro. Un doble clic no gasta dos intentos.
7. **La fecha límite bloquea empezar** (`PAST_DUE`), no solo acorta el plazo: empezar un
   intento cuyo `deadlineAt` ya pasó sería crearlo vencido.
8. **El área del estudiante se guarda por identidad, no por capacidad**
   (`requireStudentSession`): un estudiante sin matrícula no tiene capacidad ninguna, y
   `requireCapability('lesson.read')` lo metía en un bucle `/ingresar` ↔ `/aprender`. El
   mensaje «todavía no estás matriculado» existe justo para él.
9. ~~**El estudiante tiene cabecera propia** (`StudentHeader`)~~ — revertido el 20/9 por
   Jhonny: el estudiante usa la **misma barra lateral** que el staff (`SideNav` con
   `sections`, `homeHref` y `notificationsHref`). Una sola navegación que aprender. Su
   centro de notificaciones sigue en `/aprender/notificaciones`.

## 2026-09-19 — Fase 4 (2): ajustes, avance, sesiones, constancias, biblioteca

Continuación de la entrada anterior, con lo que el plan dejaba abierto en §5–§8 y en las
pantallas del estudiante:

1. **El PDF de la constancia es la página pública impresa** (`/certificado/[code]` con
   `print:hidden` en lo que no es la constancia). El plan pedía `@react-pdf/renderer`;
   no está en `package.json` (protegido) y una dependencia de ese tamaño para una hoja que
   cualquier celular imprime a PDF desde el navegador no se justifica hoy. Si el cliente
   quiere un PDF con firma y marca de agua, se añade entonces.
2. **Un módulo está completo cuando, mirado solo, cumple la regla de finalización del
   programa** (`isEnrollmentCompleted({ modules: [m] })`): todos sus temas completados y
   sus evaluaciones `SUBJECT`/`FINAL` aprobadas. Los módulos sin nada asignado en la cohorte
   no cuentan ni bloquean. La constancia de programa exige además las evaluaciones sin
   módulo (las finales).
3. **La emisión corre al abrir «Constancias»** además del job diario (que es de la Fase 5):
   idempotente por los índices únicos. Cuando el job exista, la pantalla deja de emitir.
4. **El límite de peticiones de la verificación pública es en memoria y por instancia**
   (`lib/http/rate-limit.ts`, 30/min por IP). Vale contra un barrido desde una IP; no
   contra uno distribuido. Está escrito en el archivo para que nadie lo crea más de lo que es.
5. **La biblioteca solo lista recursos de temas habilitados por la secuencia**: no es una
   puerta lateral al contenido que la progresión lineal todavía no abrió. Imágenes fuera
   (son parte del tema); documentos y audios con URL firmada de diez minutos; grabaciones
   de sesiones en vivo por enlace a Vimeo.
6. **`progress.override` cambia de URL**: `POST /api/cohorts/enrollments/[e]/lessons/[a]/complete`
   en vez de `…/progress/[progressId]/complete`, porque la fila de progreso no existe hasta
   que el estudiante abre el tema. Tachado y anotado en `endpoints.md`.
7. **`/cohortes/[id]/avance` y `/aliado` son la misma vista** (`CohortProgressView`) con
   los mismos números: la única diferencia es que el aliado no tiene enlaces a personas.
   `progress.read.cohort` se comprueba contra la cohorte (`lib/authz/cohort-scope.ts`): el
   contacto de un aliado solo ve las cohortes con su `partnerId`.
8. **El detalle de matrícula muestra los ajustes solo a quien tiene `accommodation.manage`**;
   operación no ve ni siquiera que existen («no segrega», ajustes-razonables.md). El
   reporte de inclusión cuenta y no nombra.
9. **Las preferencias de lectura viven en `localStorage`** (tamaño, espaciado, ancho): son
   del navegador de la persona, no un dato del estudiante, y no viajan al servidor.
10. **Leer la transcripción hasta el final completa un tema de video** igual que verlo
    (`transcriptReadToEnd`, que `lesson-completion.ts` ya contemplaba): el panel de
    transcripción avisa por un evento del DOM y el registrador de evidencia lo manda.
11. **`PARTNER_CONTACT` tiene área propia** (`/aliado`) y `/ingresar` lo manda ahí; antes
    caía en `/sin-acceso`.

## 2026-09-19 — Fase 5 (cartera): lo que el plan dejaba abierto

1. **El acuerdo de pago no tiene endpoint `confirm`**: `PaymentAgreement` no tiene estado
   borrador, así que la vista previa (`POST /api/billing/agreements/preview`) se calcula
   en memoria sin escribir, y la firma (`POST /api/billing/agreements`) es una sola
   transacción serializable. Los pagos sí son dos filas de estado (`confirmedAt` nulo →
   confirmado), y por eso su `confirm` existe tal cual el plan.
2. **Descartar un pago registrado y no confirmado lo anula** («Descartado antes de
   confirmar»): un registro huérfano no se borra, se anula, como cualquier otro.
3. **El monto del webhook tiene que ser exactamente lo pendiente de la cuota** para
   confirmarse solo; si no, se registra sin confirmar y se avisa a operación
   (`payment_failed` «monto distinto»). Un pago parcial por pasarela no existe: el checkout
   siempre pide lo pendiente.
4. **`WOMPI_INTEGRITY_SECRET` es una variable nueva** (además de las tres del `.env.example`):
   la firma del checkout usa el secreto de integridad, no el de eventos. Sin las llaves,
   «Pagar en línea» no aparece y queda «Datos para transferencia».
5. **La conciliación del job confirma solo lo que cuadra** (transacción `APPROVED`, monto
   igual al registrado e igual a lo pendiente); lo demás lo mira una persona.
6. **`requireAgreementForNextCohort` avisa, no bloquea**: `enrollPerson` devuelve
   `warning` y la pantalla lo enseña junto al éxito. La política es de la cartera; el
   acceso no se toca.
7. **Los recordatorios de cuota vencida van una vez al día por cuota** (`dedupeKey` cuota
   - día) y solo con `notifyPayerOnOverdue`; el correo solo si hay `RESEND_API_KEY`.
8. **El job acepta `GET` y `POST`** con `Authorization: Bearer CRON_SECRET`: Vercel Cron
   llama con `GET`. El `vercel.json` con el `crons` lo añade Jhonny (el deploy es suyo).
9. **El plan de un menor con pagador `PERSON` queda sin pagador si no se indica el
   acudiente**: no se adivina. Se edita después; hasta entonces no recibe avisos.
10. **Los recordatorios de sesión en vivo son «en las próximas 24 h»**, no 24 h y 1 h
    exactas: un job diario no puede prometer la hora. Si hace falta el aviso de 1 h,
    es un cron horario aparte.

## 2026-09-19 — Fase 6: lo que se endureció desde aquí y lo que queda en manos de Jhonny

1. **La pantalla de error genérica enseña el `digest` de Next como código de soporte**
   (`app/error.tsx`): es el mismo identificador que llega a Sentry y a los logs, y no hace
   falta un `requestId` aparte en el cliente. `global-error.tsx` va sin estilos: la CSP
   bloquea `style` y ahí no hay `globals.css`.
2. **Las tablas append-only se protegen dos veces**: el rol `app_writer` sin
   `UPDATE`/`DELETE` sobre `LearningEvent` y `AuditLog`, y un trigger que rechaza ambas
   operaciones a cualquiera que no sea `postgres`
   (`prisma/migrations/20260919000000_app_writer_role`). La migración la aplica Jhonny a
   mano en Supabase y cambia el `DATABASE_URL` de la app al rol nuevo; Prisma Migrate sigue
   como `postgres`.
3. **Anonimizar conserva la fila y sus registros**: matrículas, progreso, intentos, notas,
   cartera y auditoría son de la institución y ya no identifican a nadie sin los campos
   borrados. Se borra el usuario de Auth después de la base; si ese paso falla queda un
   usuario sin persona, inofensivo, y se registra para repetir. Pide motivo y confirmación
   escrita; `institution.manage`.
4. **El e2e público corre sin semilla** (`public.spec.ts`: portada, login, constancia,
   404, con axe y en los tres proyectos); el vertical slice con sesión queda escrito como
   pendiente hasta que el CI tenga credenciales de staging.
5. **Sentry, Vercel Analytics, k6, `EXPLAIN ANALYZE`, backups, rotación, corte y
   capacitación** no se pueden hacer desde aquí: quedan como runbooks
   (`docs/runbooks/*.md`, `docs/onboarding-institucion.md`, `docs/manuales/*.md`) con los
   pasos y tablas de tiempos vacías para el ensayo.
