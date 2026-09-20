# 09 — Glosario (lenguaje ubicuo)

Estos términos son los únicos válidos en código, docs, UI y conversación. Si necesitas
un concepto que no está aquí, añádelo antes de escribir el código que lo usa.

La columna **UI** es el texto que ve la gente (es-CO, `next-intl`); la columna **Venta** es
cómo se nombra en material comercial. El código usa el término en inglés.

## Institución y personas

| Término                         | Significado                                                                                           | UI                            | Venta            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------- |
| **Institution**                 | La entidad cliente. Raíz de tenancy y de marca: todo dato cuelga de `institutionId`.                  | "Tu institución", o su nombre | "Institución"    |
| **Person**                      | Un ser humano. Una sola fila aunque tenga varios roles. Pertenece a una institución.                  | "Persona"                     | —                |
| **User**                        | Credencial de acceso (Supabase Auth) asociada a una `Person`.                                         | "Cuenta"                      | —                |
| **Membership**                  | El par (persona, rol) en la institución.                                                              | "Rol"                         | —                |
| **Guardian** / **Guardianship** | Responsable legal de un estudiante **menor de edad**; firma su consentimiento.                        | "Acudiente" / "Acudiente de"  | —                |
| **Partner**                     | Empresa, fundación o institución que envía estudiantes en una cohorte propia y a veces la paga (B2B). | "Aliado"                      | "Entidad aliada" |

## Programa y cohortes

| Término        | Significado                                                                                | UI           | Venta      |
| -------------- | ------------------------------------------------------------------------------------------ | ------------ | ---------- |
| **Program**    | Lo que se vende: "Bachillerato Valida YA". Dueño del catálogo.                             | "Programa"   | "Programa" |
| **Module**     | Sección ordenada del programa: "Módulo Mes 1". Sus evaluaciones van después de sus temas.  | "Módulo"     | —          |
| **Subject**    | Español, Física, Inglés. Transversal.                                                      | "Asignatura" | —          |
| **Cohort**     | Edición del programa con fechas: "2026-1", "2026-1 ValoraT". Unidad comercial y académica. | "Cohorte"    | "Cohorte"  |
| **Enrollment** | Estudiante en una cohorte. Estado, acceso hasta, si era menor al matricularse.             | "Matrícula"  | —          |

## Contenido y evaluación

| Término                                | Significado                                                                                                                                                    | UI                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Lesson**                             | Contenedor editable de una unidad de contenido.                                                                                                                | "Tema"                                           |
| **LessonVersion**                      | Publicación **inmutable** de un tema. `content` es Markdown.                                                                                                   | "Versión" (solo autores)                         |
| **Assignment**                         | Un tema o evaluación disponible para una cohorte; su versión puede cambiar.                                                                                    | —                                                |
| **MediaAsset**                         | Video (Vimeo), imagen, audio o PDF referenciado desde el Markdown, con su alternativa accesible.                                                               | "Recurso"                                        |
| ~~**Legacy**~~ (RETIRADO 18/9)         | Recurso migrado sin alternativa textual, publicado con excepción auditada. Sin importación desde LearnDash no existe: todo recurso publicado trae alternativa. | —                                                |
| **LessonProgress**                     | Avance de una matrícula sobre un tema, con evidencia.                                                                                                          | "Progreso"                                       |
| **Assessment** / **AssessmentVersion** | Contenedor editable / publicación inmutable de una evaluación (preguntas + `answerKey` aparte + reglas del intento).                                           | "Evaluación"                                     |
| **Attempt**                            | Un intento. Respuestas, ajustes aplicados, nota y estado.                                                                                                      | "Intento"                                        |
| **Score**                              | Nota de una asignatura en una cohorte, 0–100, derivada del mejor intento.                                                                                      | "Nota"                                           |
| **Submission**                         | Entrega de una actividad (tema con `requiresSubmission`): texto y/o archivo, revisada por un instructor.                                                       | "Entrega"                                        |
| **LiveSession**                        | Clase sincrónica de una cohorte: enlace y fecha.                                                                                                               | "Clase en vivo"                                  |
| **Certificate**                        | Constancia de finalización de módulo o programa, con código público verificable. **No es el título de bachiller.**                                             | "Constancia" (módulo) / "Certificado" (programa) |

## Ajustes razonables

| Término           | Significado                                                                                | UI        |
| ----------------- | ------------------------------------------------------------------------------------------ | --------- |
| **PIAR**          | Plan Individual de Ajustes Razonables (Decreto 1421). Aquí es la entidad `Accommodation`.  | "PIAR"    |
| **Accommodation** | Regla ejecutable por matrícula: tiempo adicional, sin cronómetro, subtítulos obligatorios… | "Ajustes" |

## Cartera

| Término              | Significado                                                           | UI                  |
| -------------------- | --------------------------------------------------------------------- | ------------------- |
| **PaymentPlan**      | Lo que cuesta una matrícula, en cuotas, y quién lo paga.              | "Plan de pago"      |
| **Installment**      | Una cuota con fecha y estado.                                         | "Cuota"             |
| **Payment**          | Un abono a una cuota. Se confirma; se anula, nunca se borra.          | "Pago"              |
| **Account**          | Estado **derivado** por matrícula.                                    | "Estado de cuenta"  |
| **PaymentAgreement** | Acuerdo firmado para ponerse al día; sus cuotas son `Installment`.    | "Acuerdo de pago"   |
| **Restriction**      | Capacidad no académica suspendida por mora según `RestrictionPolicy`. | — (nunca "bloqueo") |

## Etiquetas de estados (UI, es-CO)

| Valor                                                      | Texto                                                             | Nota                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Cuenta `CURRENT`                                           | Al día                                                            | check                                                                  |
| Cuenta `OVERDUE`                                           | Con cuota vencida                                                 | Nunca "en mora" hacia el estudiante                                    |
| Cuenta `IN_AGREEMENT`                                      | En acuerdo de pago                                                |                                                                        |
| Cuenta `PARTNER_PAID`                                      | Financiada por una entidad aliada                                 | Decisión 8: no se nombra al aliado                                     |
| Entrega `SUBMITTED` / `RETURNED` / `APPROVED`              | Enviada, en revisión / Devuelta con comentarios / Aprobada        |                                                                        |
| Cuota `OPEN` / `PARTIALLY_PAID` / `PAID` / `VOID`          | Pendiente / Abonada / Pagada / Anulada                            | "Vencida" se deriva y se muestra como "Pendiente · vencida el {fecha}" |
| Matrícula `ACTIVE` / `COMPLETED` / `WITHDRAWN`             | Activa / Completada / Retirada                                    | Acceso vencido: "Acceso vencido el {fecha}"                            |
| Cohorte `PLANNED` / `OPEN` / `CLOSED` / `ARCHIVED`         | Por iniciar / En curso / Cerrada / Archivada                      |                                                                        |
| Progreso `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED`       | Sin empezar / En curso / Completado                               | Bloqueado: "Se habilita al completar {tema}"                           |
| Intento `IN_PROGRESS` / `SUBMITTED` / `EXPIRED` / `GRADED` | En curso / Entregado / Tiempo vencido sin respuestas / Calificado |                                                                        |
| Subtítulos `NONE` / `AUTO` / `REVIEWED`                    | Sin subtítulos / Automáticos (pendientes de revisión) / Revisados | Solo autores                                                           |
