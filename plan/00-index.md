# Plan de implementación — Colombia Estudia

`reference/` dice **qué** es el sistema (SSOT). `plan/` dice **cómo** se construye, fase por
fase, con las prácticas que usan los equipos que operan software en producción con datos
de personas: no como aspiración, sino como pasos con archivos, comandos y criterios de
salida. Si `plan/` y `reference/` difieren, manda `reference/` y se corrige el plan.

Cada documento sigue el mismo patrón: **objetivo → decisiones → pasos concretos → qué
queda hecho → criterio de salida**. Los criterios de salida son los de
`reference/07-testing-matrix.md`; aquí se detallan.

| Doc                                                                  | Qué cubre                                                                                                             | Fase        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| [`01-arquitectura-y-estructura.md`](01-arquitectura-y-estructura.md) | Monorepo, estructura de carpetas, límites entre módulos, reglas de dependencia, nombres                               | Transversal |
| [`02-fundaciones.md`](02-fundaciones.md)                             | Entornos, Supabase, Prisma, cliente por tenant, CI/CD, secretos, observabilidad, tokens, módulo a11y                  | 1           |
| [`03-identidad-y-acceso.md`](03-identidad-y-acceso.md)               | Middleware, sesión, login, invitación, recuperación, MFA de staff, `withCapability` con alcance                       | 1           |
| [`04-seguridad.md`](04-seguridad.md)                                 | Modelo de amenazas, cabeceras, CSRF, subida de archivos, webhooks, PII, auditoría, dependencias, respaldo, incidentes | Transversal |
| [`05-datos-y-migraciones.md`](05-datos-y-migraciones.md)             | Flujo de migraciones, índices parciales, transacciones, `Decimal`, append-only, semillas, aislamiento                 | 1 → 6       |
| [`06-cohortes-y-personas.md`](06-cohortes-y-personas.md)             | Institución, cohortes, personas, CSV en tres pasos, invitaciones, notificaciones                                      | 2           |
| [`07-contenido-y-migracion.md`](07-contenido-y-migracion.md)         | Parser del Markdown, editor, validación de publicación, Vimeo, importador de LearnDash, OCR                           | 3           |
| [`08-aprender-y-evaluar.md`](08-aprender-y-evaluar.md)               | Player, evidencia, motor de intentos, entregas, sesiones en vivo, certificados, aliado                                | 4           |
| [`09-cartera.md`](09-cartera.md)                                     | Planes, cuotas, pagos manuales, Wompi, acuerdos, estado de cuenta, job diario                                         | 5           |
| [`10-endurecer-y-lanzar.md`](10-endurecer-y-lanzar.md)               | Observabilidad, e2e, restauración, corte, capacitación, rollback                                                      | 6           |
| [`11-ux.md`](11-ux.md)                                               | Principios, flujos clave con estados, móvil, formularios, carga y error, offline, copy                                | Transversal |
| [`12-calidad-y-proceso.md`](12-calidad-y-proceso.md)                 | Git, PR, revisión, DoD, pirámide de pruebas, ADRs, releases                                                           | Transversal |

## Cómo se usa

1. Antes de empezar una fase: leer su doc completo y el `11-ux.md` y `04-seguridad.md` en
   lo que la toque.
2. Cada paso del doc es un PR o un grupo de PRs pequeños (`12-calidad-y-proceso.md`).
3. Una fase no cierra sin sus criterios de salida en verde y sin actualizar `reference/`.
4. Lo que el plan no cubre se decide con un ADR (`docs/adr/`), no en un commit.

## Principios que atraviesan todo el plan

- **Lo aburrido primero**: entornos, migraciones por CI, aislamiento por tenant y el
  módulo de accesibilidad existen antes del primer componente. Es lo que nadie quiere hacer
  en la semana 12.
- **El dominio es puro**: `packages/domain` no importa Prisma, Next ni React. Recibe datos y
  `now`, devuelve decisiones. Se prueba en milisegundos.
- **Una sola forma de hacer cada cosa**: un wrapper de autorización, un cliente de datos,
  un anunciador de a11y, un formato de error, un formato de log. La segunda forma es un bug.
- **Todo lo que cambia estado de una persona deja rastro** (`AuditLog`) y se puede deshacer
  o explicar.
- **El límite del encargo es el entregable**: cada fase entrega lo que dice, no más.
