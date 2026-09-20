# 04 — Reportes y métricas

Los números que ven el director, operaciones y el aliado. Cada uno con fórmula y fuente,
para que "30 % completado" signifique lo mismo en todas las pantallas. Son el primer
consumidor de `LearningEvent` y `AuditLog`.

**SSOT**: `packages/domain/src/metrics.ts` (funciones puras sobre los datos de una cohorte).

| Métrica                              | Fórmula                                                                                          | Fuente                         | Quién la ve                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------- |
| Tasa de finalización                 | matrículas `COMPLETED` / matrículas que alguna vez fueron `ACTIVE`                               | `Enrollment`                   | director, aliado                    |
| Avance con evidencia                 | temas `COMPLETED` con `source = EVIDENCE` / temas asignados, por matrícula y promedio de cohorte | `LessonProgress`               | todos                               |
| Avance importado o manual            | temas `COMPLETED` con `source ≠ EVIDENCE` (se muestra aparte, nunca sumado)                      | `LessonProgress`               | operaciones                         |
| Mediana de días hasta completar      | mediana(`completedAt − enrolledAt`) de las `COMPLETED`                                           | `Enrollment`                   | director                            |
| En riesgo                            | matrículas `ACTIVE` sin `LearningEvent` en ≥ 14 días                                             | `LearningEvent`                | operaciones, aliado                 |
| Evaluaciones presentadas / aprobadas | intentos `GRADED` / matrículas; aprobadas = `score/maxScore × 100 ≥ passPercent`                 | `Attempt`, `AssessmentVersion` | todos                               |
| Cartera                              | % matrículas por estado derivado (`CURRENT`, `OVERDUE`, `IN_AGREEMENT`, `PARTNER_PAID`)          | `account-status`               | operaciones; aliado solo su cohorte |
| Ajustes aplicados                    | ajustes vigentes por cohorte y cambios en el periodo, con quién los autorizó                     | `Accommodation`, `AuditLog`    | admin, coordinación                 |
| ~~Legado~~ (RETIRADO 18/9)           | medía la conversión del contenido migrado; sin importación no hay qué medir                      | —                              | —                                   |

## Exportación

`GET /api/partner/cohort/export` y `GET /api/cohorts/[id]/export` devuelven CSV por
estudiante: temas completados (con evidencia / sin), evaluaciones presentadas y aprobadas,
última actividad, en riesgo, estado de matrícula. Un aliado que financia reporta a quien
lo financia; necesita esto en Excel, no en una pantalla.

`GET /api/inclusion/report` (`accommodation.manage`): el reporte del Decreto 1421.

## Lo que no se reporta

Datos de salud (no existen), quién tiene ajustes a otros estudiantes, cartera de un
estudiante a un instructor, nada individual al aliado que no sea de su cohorte.
