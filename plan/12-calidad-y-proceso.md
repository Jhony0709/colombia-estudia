# 12 — Calidad y proceso

## Git

Trunk-based: `main` protegido; ramas cortas `feat/…`, `fix/…`, `chore/…` que viven días,
no semanas; PRs pequeños (< 400 líneas netas salvo generado). Commits con el formato de
`CLAUDE.md`: `<area>: <qué> (<doc-reference-afectado>)`. Los commits los hace Jhonny.

## Pull request

Plantilla (`.github/PULL_REQUEST_TEMPLATE.md`):

```
## Qué cambia (para el usuario)
## Qué se pidió y no se hizo, y por qué
## Desviaciones respecto a reference/ o al plan
## Verificación
- [ ] type-check pegado
- [ ] tests (unit / integración / e2e) pegados
- [ ] pa11y-ci / axe pegado si tocó UI
- [ ] story si es componente
- [ ] reference/ actualizado en este PR
- [ ] migración incluida si tocó schema; sin `db push`
- [ ] sin PII ni datos reales en fixtures
```

Revisión (aunque sea propia, con checklist): ¿capacidad con alcance en cada handler nuevo?
¿serializador? ¿`institutionId`? ¿`AuditLog` en mutaciones sensibles? ¿copy del glosario?
¿`useAnnounce` y foco? ¿tokens? ¿un solo camino?

## Definition of Done

La de `reference/03-ui/accesibilidad.md` para UI, más: documentado en `reference/`, probado
en el nivel que le toca (`07-testing-matrix.md`), sin `any`, sin `console.log`, sin
`TODO` sin issue, `knip` y depcruise en verde.

## Pirámide de pruebas (herramientas)

| Nivel       | Herramienta                                       | Corre                                 |
| ----------- | ------------------------------------------------- | ------------------------------------- |
| Unit        | Jest (`packages/*`, `lib/*`, hooks)               | cada PR, < 30 s                       |
| Integración | Jest + Supabase local (Docker en CI)              | cada PR                               |
| API         | Jest sobre route handlers con `NextRequest`       | cada PR                               |
| Componentes | Storybook + `@storybook/test-runner` + addon-a11y | cada PR                               |
| e2e         | Playwright + axe, 2 viewports, reduced-motion     | cada PR (subset) y nightly (completo) |
| Carga       | k6                                                | fase 6 y antes de cada release mayor  |
| Manual      | Persona con VoiceOver/TalkBack                    | cierre de fase                        |

Fixtures y factories en `__tests__/factories/` con faker `es`; una factory por modelo,
usada por el test de aislamiento.

## ADRs

`docs/adr/NNNN-titulo.md` (contexto, decisión, consecuencias) para lo que no está en
`PRODUCT_DECISIONS.md` y es técnico: elección de librería, cambio de patrón, excepción a
una regla. Una excepción sin ADR no se mezcla.

## Dependencias

Renovate semanal agrupado; mayores a mano; `pnpm audit --audit-level high` en CI;
nueva dependencia = ADR de tres líneas + aprobación (regla de `CLAUDE.md`).

## Releases

Tag por cierre de fase (`v0.1.0` fundaciones … `v1.0.0` lanzamiento) con changelog
generado desde los commits; `docs/estado.md` actualizado en cada tag. Deploy continuo a
staging; a prod solo desde `main` con CI verde y `migrate deploy` previo.

## Ritmo

Una fase = un objetivo verificable; al cerrar: criterios de salida, media hora de
recorrido manual, `reference/` al día, tag. Si una fase se alarga más del 30 %, se recorta
alcance (y se ficha), no se estira el plazo en silencio.

## Deuda

`docs/estado.md` tiene una sección "Deuda" con: qué, por qué se aceptó, cuándo se paga.
Deuda no fichada es deuda que no existe hasta que explota.
