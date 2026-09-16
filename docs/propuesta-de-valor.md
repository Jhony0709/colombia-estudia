# Propuesta de valor (una página)

## Para quién

**Director de un programa en cohortes** (bachillerato acelerado, validación, educación de
adultos, formación técnica): hoy opera sobre un LMS genérico, con el PIAR en Word, la
cartera en Excel y sin saber cuánto de su "30 % completado" es real.

**Entidad aliada** (fundación, empresa, otra institución) que financia o envía una cohorte
y debe reportar a quien la financia: necesita avance con evidencia por estudiante, en
Excel, sin pedirlo por WhatsApp.

**Operaciones**: la persona que matricula, cobra, invita, responde "olvidé la clave" y
sabe quién está al día. Hoy con cuatro herramientas; aquí con una.

## El problema

Un LMS genérico enseña cursos a individuos. Un programa en cohortes vende ediciones con
fechas a personas que pagan en cuotas, a veces a través de un aliado, con obligaciones
legales (ajustes razonables, habeas data, jurisprudencia sobre mora) que el LMS no conoce.
El resultado: clones de cursos por aliado, progreso que es un clic, cartera fuera del
sistema, y cumplimiento que depende de la memoria de un administrador.

## Tres diferenciadores, con la evidencia que el sistema produce

| Diferenciador                                                         | Qué hace                                                                                                                                                                                     | Evidencia que sale sola                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **PIAR ejecutable**                                                   | Los ajustes razonables (Decreto 1421) son reglas que el motor de evaluaciones aplica: tiempo adicional, sin cronómetro, intentos extra, subtítulos obligatorios. Se congelan en cada intento | Reporte por cohorte de ajustes otorgados, por quién y cuándo (`AuditLog`)                   |
| **Accesibilidad que se cumple en el contenido, no solo en el código** | WCAG 2.2 AA como gate: un tema sin alternativa textual no se publica; el legado tiene fecha de conversión y lista visible                                                                    | Lista de legado llegando a cero; solicitudes de versión accesible atendidas                 |
| **Una fuente, N cohortes; cartera que respeta la ley**                | Mismo catálogo versionado para cada cohorte y aliado; avance con evidencia; cuotas, pagos y acuerdos con estado derivado; nunca un botón que excluya a un menor por mora                     | Avance exportable por cohorte; % al día / en acuerdo; acuerdos como prueba de ánimo de pago |

## Contra qué se compara

- **LearnDash / Moodle a medida**: potentes y genéricos; todo lo de arriba hay que
  construirlo con plugins y no queda auditado.
- **Q10, Phidias, Master2000**: sistemas de gestión escolar K-12; sirven de comparable solo
  en la parte administrativa (Q10 Básico: $920 k + $4 k/estudiante al mes). No modelan
  cohortes ni contenido versionado.

## Qué no es

No es un SIS de colegio (grados, grupos, boletines). No es un marketplace de cursos. No
tiene gamificación. No es un tutor de IA (podrá serlo, acotado al contenido, cuando haya
contenido de calidad y habeas data resuelto).

## Paridad y ventaja frente a un LMS en WordPress

Todo lo que una propuesta típica de LMS en WordPress incluye (clases en vivo, certificados,
entregables, pagos en línea, calendario, biblioteca, correos automáticos, paneles) está en
el MVP. Lo que no incluye —accesibilidad verificada, PIAR ejecutable, cohortes sin clonar,
cartera con acuerdos, contenido portable, auditoría— es la ventaja. Comparativa completa en
`propuesta-comercial-validaya.md` §8.

## Cómo se vende

Primer cliente como socio de diseño: implementación reducida + licencia mensual, con la
propiedad intelectual de la plataforma en manos del proveedor. Siguientes: licencia por
estudiante activo y por institución, con onboarding según `onboarding-institucion.md`.
