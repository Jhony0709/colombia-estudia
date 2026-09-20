# Roadmap

Regla: **no construir las capacidades avanzadas; diseñar para ellas e implementar primero
un vertical slice completo.** El vertical slice es el de Valida YA, no el de un LMS
genérico ni el de un colegio:

```
operaciones crea la cohorte 2026-2 y carga personas y matrículas (CSV)
        ↓
el contenido del programa (migrado de LearnDash) queda asignado a la cohorte
        ↓
el estudiante entra, ve sus módulos en orden, estudia un tema (Markdown + video Vimeo)
y el sistema registra evidencia de que lo hizo
        ↓
presenta la evaluación de la asignatura con sus ajustes; se califica sola
        ↓
ve sus resultados y, si paga él, sus cuotas; el aliado ve el avance de su cohorte
        ↓
operaciones registra pagos, un acuerdo de pago, y ve quién está al día
```

Cuando eso funciona de punta a punta, con teclado y lector de pantalla, con contenido real
migrado, hay producto que reemplaza a LearnDash.

## Fases del MVP

Cada fase termina con: `type-check` + lint + tests en verde, gates de a11y en verde, docs
de `reference/` actualizados, y media hora de recorrido manual con teclado y lector de
pantalla. Sin eso no se cierra.

### Fase 0 — Dominio en papel ✅

Glosario, reglas, schema, decisiones, análisis de LearnDash, auditoría de tres paneles,
contrato de diseño y skills, las 11 decisiones cerradas, paridad con la propuesta
competidora. **Hecho** (14/9). Quedan para después, por decisión: asesoría jurídica sobre
mora en adultos y plan de Vimeo (antes de producción).

### Fase 1 — Fundaciones (2-3 semanas)

- Monorepo desde la plantilla de don-pepo: `apps/web`, `packages/domain`, `packages/types`,
  tooling (turbo, husky, knip, depcruise, prettier, eslint + jsx-a11y). Sin `apps/mobile`.
- **Dos proyectos Supabase (staging, prod) + local con Supabase CLI.** Previews de Vercel
  → staging. `prisma migrate deploy` en GitHub Action sobre `main`, nunca a mano. Sentry
  desde el primer handler. Nada de datos reales en local.
- Primera migración con el schema + índices únicos parciales en SQL + RLS deny-all.
- Cliente Prisma extendido con `institutionId` (y `omit` de `answerKey`) + **test de
  aislamiento por tabla**.
- `packages/design-tokens` según `reference/03-ui/tokens.md` (incluido `focus.ring` y las
  variables de preferencias de lectura) + test de contraste.
- `apps/web/lib/a11y/`: `useAnnounce`, `FocusManager`, `AccessibilityPreferencesProvider`,
  `SkipLink`. Antes del primer componente.
- `packages/types/src/content.ts`: parser y validador del Markdown (directivas, LaTeX,
  `:lang`, assets) y schema Zod de evaluaciones.
- `packages/domain`: `capabilities.ts` (con alcance), `account-status.ts`,
  `attempt-policy.ts`, `publish-validation.ts`, `grading.ts`, `lesson-completion.ts`,
  `enrollment-completion.ts`, `metrics.ts` — tests al 90 % **antes de cualquier pantalla**.
- Auth: login, callback, logout, recuperación, invitación en 3 pasos con consentimiento.
  `withCapability` con alcance. `GET /api/me`. Tenant por `Institution.primaryDomain` en
  `middleware.ts`; dominio propio del cliente en Vercel.
- Storybook + addon-a11y, pa11y-ci, axe en Playwright: los gates existen desde el primer
  componente.
- Desplegado en staging con una institución de prueba.

### Fase 2 — Institución, cohortes y personas (2 semanas)

- Admin: programa, módulos, asignaturas. Políticas.
- Admin: marca, contacto y política de datos de la institución.
- Operaciones: cohortes (crear, abrir, cerrar), matrículas y su ciclo (retirar, prorrogar),
  aliados, personas, roles, acudencias (menores), consentimientos en papel, invitaciones
  (pendiente / vencida / aceptada, reinvitar).
- **Carga CSV** en 3 pasos (plantilla → validación en seco → confirmar). Exige `birthDate`;
  menor ⇒ acudiente; todo o nada.
- Centro de notificaciones.
- `AuditLog` en cada mutación administrativa; `person.pii_read` al abrir un detalle.

### Fase 3 — Contenido y migración (3-4 semanas)

Ya no la limita el importador sino **quién escribe el contenido**: los 110 temas y las 7
evaluaciones se redactan en la plataforma. El efecto en el calendario está sin recalcular.

- Editor Markdown accesible (CodeMirror 6): pegar o subir imágenes con diálogo de `alt`,
  fórmulas con vista previa, `:lang`, panel de avisos navegable, vista previa real.
  Registro de videos de Vimeo por id con `captionsSource`.
- Publicación: `publish-validation` rechaza con lista. `LessonVersionAsset`. `LessonVersion`
  inmutable; `invalidatesProgress`.
- Editor de evaluaciones (`single_choice`, `multiple_choice`, `true_false`, `short_text`)
  con `answerKey` aparte y reglas del intento en la versión.
- ~~**Importador de LearnDash**~~ — **CANCELADO el 18/9** (ver `PRODUCT_DECISIONS.md` y
  `plan/07` §7): todo el contenido es nuevo. En su lugar entraron la creación de temas y
  evaluaciones desde la plataforma (`POST /api/content/lessons`, `POST /api/content/assessments`).
- ~~**Pipeline OCR**~~ — **CANCELADO el 18/9**: sin migración no hay imágenes de página que
  transcribir.
- Biblioteca: recursos descargables por módulo.
- ~~`/contenido/legado`~~ — **CANCELADO el 18/9**: ninguna versión se publica con excepción
  de legado, así que no hay lista que llevar.
- Verificar la restricción por dominio en Vimeo con el dominio nuevo.

### Fase 4 — Aprender y evaluar (3 semanas)

- `/aprender` con todos sus estados (por iniciar, vencido, completada, retirada, menor sin
  consentimiento); progresión lineal con copy de bloqueo.
- Player: Markdown con encabezados y foco correctos, MathML, Vimeo accesible con
  **transcripción sincronizada** (WebVTT, clic lleva al segundo, SDK del player) y "solo
  transcripción", legado con aviso, zoom y "Pedir versión accesible", "Reportar un
  problema". Preferencias de lectura. Evidencia de progreso por forma de contenido.
- Intentos: pantalla previa; inicio con ajustes congelados y `deadlineAt`; autosave con
  cola local; cronómetro accesible; confirmación de entrega; vencido con respuestas →
  entregado y calificado; `reviewPolicy`.
- `LearningEvent` en cada acción; `Score` derivado.
- Ajustes (`Accommodation`) desde el detalle de matrícula.
- **Entregas de actividad**: formulario en el player, cola de revisión, aprobar/devolver.
- **Sesiones en vivo**: alta por cohorte, calendario del estudiante, recordatorios.
- **Certificados**: emisión automática por módulo y programa, página pública de
  verificación, revocación.
- Cohortes: avance, `progress.override`, exportar CSV. `/aliado` con métricas y exportación.
- Estudiante: resultados, calendario, biblioteca, certificados. (`/familia` fuera, decisión 7.)

### Fase 5 — Cartera (2 semanas)

- Planes de pago por matrícula (y en bloque para una cohorte de aliado), cuotas, pagos en
  dos pasos con anulación, acuerdos en dos pasos con cuotas reales.
- **Pago en línea con Wompi**: checkout desde `/aprender/mi-cuenta`, webhook idempotente,
  conciliación en el job. Sandbox en staging.
- `account-status` en `/aprender/mi-cuenta`, `/aliado` y `/cartera`; exportar.
- Job diario (Vercel Cron): recordatorios con `dedupeKey`, acuerdos vencidos,
  `convertUntil`, intentos vencidos.
- `RestrictionPolicy` con sus advertencias y auditoría. Sin flag de suspensión para
  adultos hasta la asesoría jurídica.

### Fase 6 — Endurecer, migrar y lanzar (2 semanas)

- Sentry, logs estructurados con `institutionId` y `requestId`.
- Rol de BD sin UPDATE/DELETE sobre `LearningEvent` y `AuditLog`.
- Backups verificados (restaurar uno).
- Playwright e2e del vertical slice completo, con axe.
- Recorrido completo con VoiceOver/NVDA.
- **Plan de corte** (decisión 1: solo cohortes nuevas): congelación de edición de contenido
  en WordPress desde D-7 → dump → importación definitiva de contenido → verificación de
  conteos → la primera cohorte nueva se matricula por CSV en la plataforma → invitaciones.
  Las cohortes en curso terminan en LearnDash; validaya.com sigue como sitio público (sin
  LearnDash cuando acabe la última). **Regla de rollback**: si la primera cohorte nueva no
  puede operar antes de D+14, se matricula en LearnDash y se pierde lo hecho en la nueva;
  ensayada en staging.
- Anonimización probada (Ley 1581).
- LearnDash en solo lectura un mes; después se apaga.
- Capacitación a operaciones; `docs/onboarding-institucion.md` como runbook.

**Total estimado: 18-20 semanas a tiempo completo** (la paridad con la propuesta
competidora añadió ~2 semanas: entregas, sesiones en vivo, certificados, Wompi). En
paralelo con Basikon, el doble. Como el corte es solo para cohortes nuevas, la fecha de
lanzamiento se fija con la apertura de una cohorte, no contra las que están en curso.
Criterios de aceptación por fase en `reference/07-testing-matrix.md`; hitos para el
cliente en `docs/propuesta-comercial-validaya.md`.

## Después del MVP (en orden probable de demanda real)

1. Conversión del legado restante a Markdown y revisión de subtítulos (continúa hasta
   llegar a cero).
2. `/familia` (login de acudiente) y `open_text` calificado.
3. Facturación electrónica DIAN vía proveedor.
4. Contrato de aliado que agrupe la cartera de una cohorte.
5. Competencias / DBA del MEN desde `learningObjective`; reporte por competencia.
6. Segunda institución: `Person` global multi-institución, llaves de Wompi por
   institución, facturación por institución (el runbook ya existe).
7. Tutor IA acotado al contenido del programa, con citas — con habeas data resuelto antes
   de la primera línea.

Lo que no está en esta lista (realtime, gamificación, learning paths, knowledge graph,
Mux) no tiene fecha porque no tiene a nadie pidiéndolo.
