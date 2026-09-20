# Handoff — estado al cierre de la fase 0 (14/9/2026)

Este documento existe para que una sesión nueva, con solo esta carpeta como contexto,
pueda continuar sin leer ninguna conversación anterior. Si algo de aquí contradice a
`reference/`, manda `reference/`.

## Qué es esto

**Colombia Estudia**: plataforma multitenant para instituciones que dictan programas en
cohortes. Primer cliente: **Valida YA** (validaya.com), bachillerato acelerado en cohortes
de ~6 meses, ~100 estudiantes activos, hoy en WordPress + LearnDash + Vimeo. El objetivo
del MVP es **reemplazar LearnDash** sin perder nada de lo que Valida YA usa.

Diferenciadores: PIAR ejecutable (Decreto 1421), accesibilidad WCAG 2.2 AA validada en el
contenido, una fuente / N cohortes con aliados B2B, cartera que respeta la jurisprudencia.

## Dónde está cada cosa

| Quiero…                                                                                      | Leo                                                                   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| El lenguaje y las etiquetas de UI                                                            | `reference/09-glossary.md`                                            |
| Cómo se opera hoy en LearnDash                                                               | `docs/analisis-validaya-learndash.md`                                 |
| Las reglas de negocio                                                                        | `reference/04-business-logic/*.md`                                    |
| El modelo de datos y por qué                                                                 | `reference/05-database/schema.md` → `prisma/schema.prisma` (validado) |
| Rutas, endpoints, errores                                                                    | `reference/01-routing/routes.md`, `reference/02-api/*.md`             |
| Accesibilidad, tokens, diseño                                                                | `reference/03-ui/*.md`, `DESIGN.md`, `.claude/skills/*`               |
| Qué se decidió y qué falta decidir                                                           | `PRODUCT_DECISIONS.md` (sección "PENDIENTES DE JHONNY")               |
| Qué se hace después y en qué orden                                                           | `ROADMAP.md`, `reference/07-testing-matrix.md`                        |
| **Cómo** se construye cada fase (carpetas, middleware, login, seguridad, datos, UX, proceso) | `plan/00-index.md` y los 12 docs de `plan/`                           |
| Qué encontró la auditoría y qué se hizo                                                      | `docs/auditoria-fase0.md`                                             |
| Cómo vender y cómo dar de alta otra institución                                              | `docs/propuesta-de-valor.md`, `docs/onboarding-institucion.md`        |
| Cómo trabajar en este repo                                                                   | `CLAUDE.md`                                                           |

## Estado

El detalle por fase está en `docs/estado.md`, que es el documento que se actualiza. Esto es
solo el resumen para orientarse (18/9/2026):

- **Fases 0, 1 y 2 cerradas.** Fundaciones, observabilidad, CI/CD, auth con MFA e
  invitaciones, institución, programas, módulos, asignaturas, cohortes, matrículas,
  personas, acudencias, consentimientos, carga CSV y notificaciones.
- **Fase 3 (contenido) avanzada**: temas, evaluaciones, versiones, publicación, validación,
  media y Vimeo. Falta el importador de LearnDash y el pipeline de OCR.
- **Fase 4 (aprender y evaluar) iniciada**: `features/learn` tiene los servicios de cohorte
  y de tema; falta todo el camino del intento (presentar, autoguardar, entregar, calificar).
- **Fase 5 (cartera) sin empezar**: `features/billing` está vacía.
- `prisma/schema.prisma` tiene **36 modelos** y pasa `prisma validate`. Dos migraciones.
- **Repositorio git en `main` con remoto `origin`.** Los commits los hace Jhonny.
- Las tres skills están en `.claude/skills/`.

## Decisiones tomadas (14/9, tarde)

Las 11 de la auditoría están cerradas en `PRODUCT_DECISIONS.md`: corte solo para cohortes
nuevas (el importador migra contenido, no personas ni progreso), dominio propio por
cliente, legado con texto automático, sin revisión de subtítulos por ahora, `/familia`
fuera del MVP (consentimiento de menores en papel), "una entidad aliada", Supabase Pro
basta. Quedan para antes de producción: asesoría jurídica sobre mora en adultos y plan de
Vimeo. Un agente no las reabre.

**Accesibilidad (14/9, tarde)**: se revisó una propuesta externa; el objetivo subió a WCAG
2.2 AA, entraron tres principios propios, el módulo `apps/web/lib/a11y/`, transcripción
sincronizada y preferencias de lectura. El marco europeo de esa propuesta no aplica.

**Paridad con la propuesta competidora**: Valida YA recibió una propuesta de LMS en
WordPress (Zona 57, 16 semanas) y eligió a Jhonny. Entraron al MVP: entregas de actividad
(`Submission`), clases en vivo (`LiveSession`), certificados con verificación pública
(`Certificate`), pago en línea con Wompi, calendario y biblioteca. La propuesta comercial
espejo, con la comparativa, está en `docs/propuesta-comercial-validaya.md`; los precios
están por confirmar (⟦ ⟧).

## Cómo trabaja el agente aquí (resumen de CLAUDE.md)

- Español al usuario; código, comentarios, identificadores y rutas de API en inglés; URLs de UI en español.
- `reference/` antes que código; se actualiza en la misma PR.
- **Nunca commitea**: los commits son de Jhonny. Escribe en el árbol de trabajo y reporta.
- Cita `archivo:línea`; distingue evidencia de inferencia; cuando se equivoca lo dice y
  dice dónde propagó el error.
- Límite del encargo = entregable. Hacer de más también es incumplir.
- Tres reglas no negociables: la mora nunca toca la educación de un menor (adultos,
  pendiente de asesoría); accesibilidad AA es gate de CI; ningún diagnóstico en la BD.
- Datos reales de estudiantes: nunca en local, nunca en tests, nunca en un documento.
- Toda respuesta del agente termina con la línea `No commitees nada.`

## Lo que NO está en esta carpeta a propósito

Credenciales, datos de estudiantes, la transcripción de la reunión con Tri (es de otro
proyecto), el análisis de precios de infraestructura (resumen: Vercel Pro 20 + Supabase Pro
25 USD/mes es el arranque; Wompi 2,65 % + $700 + IVA por transacción; TRM ~3.116 el 9/9).

## Primer paso sugerido para la próxima sesión

1. Leer `README.md` → `reference/09-glossary.md` → `PRODUCT_DECISIONS.md` → `ROADMAP.md`.
2. Confirmar con Jhonny los ⟦ ⟧ de la propuesta comercial si va a enviarla, y la
   dedicación (20 semanas a tiempo completo vs ~40 en paralelo).
3. Arrancar la fase 1 siguiendo `plan/02-fundaciones.md` paso a paso (repositorio,
   entornos, Prisma, aislamiento, dominio con tests, tokens y a11y, observabilidad, CI,
   identidad), sobre la plantilla de don-pepo (`~/development/food-save`), sin `apps/mobile`.
