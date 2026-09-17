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
