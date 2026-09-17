# 02 — Errores

`APIError(message, code, details?)` en `apps/web/lib/core/errors.ts`. Ningún
handler devuelve `NextResponse.json({ error })` a mano.

| Código                    | HTTP | Cuándo                                                                                                         |
| ------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`        | 400  | Zod falló; `details` trae los campos                                                                           |
| `INVALID_CONTENT`         | 400  | El Markdown o el JSON de evaluación no cumple el contrato; `details` = lista navegable (línea, regla, arreglo) |
| `UNAUTHENTICATED`         | 401  | Sin sesión                                                                                                     |
| `FORBIDDEN_ORIGIN`        | 403  | Sec-Fetch-Site indica cross-site y Origin no es el host esperado                                               |
| `INSUFFICIENT_CAPABILITY` | 403  | Sin la capacidad, o recurso fuera del alcance (misma institución, otra cohorte)                                |
| `CONSENT_REQUIRED`        | 403  | Menor sin `Consent` vigente                                                                                    |
| `NOT_FOUND`               | 404  | No existe **o no es de esta institución** (no se distingue)                                                    |
| `CONFLICT`                | 409  | Duplicado, intento ya abierto, cuota ya pagada                                                                 |
| `ATTEMPT_EXPIRED`         | 410  | `deadlineAt` pasado                                                                                            |
| `ACCESS_EXPIRED`          | 410  | `accessUntil` pasado                                                                                           |
| `LESSON_LOCKED`           | 423  | Progresión lineal: falta completar el anterior; `details.blockedBy`                                            |
| `RATE_LIMITED`            | 429  |                                                                                                                |
| `INTERNAL`                | 500  | Sentry; nunca el stack al cliente                                                                              |

El mensaje es para el desarrollador, en inglés. El texto para la persona lo pone la UI
desde `next-intl` a partir de `code` (glosario, tabla "Etiquetas de UI").
