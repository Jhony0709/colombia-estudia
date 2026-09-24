# Runbook — Poner en marcha una institución

Lo que hace operaciones, en orden, para que una institución empiece a dictar. Es también el
guion de la capacitación de 2 h (plan/10 §7).

## 1. La institución (ADMIN)

`/admin/institucion`: nombre, correo de soporte, nombre del remitente de correos, color de
marca. `/admin/politicas`: las dos banderas de cartera (apagadas al empezar).

## 2. El plan de estudios (ADMIN)

`/contenido/asignaturas` → `/contenido/programas` (con sus módulos, en orden). Sin
programa no hay tema que escribir.

## 3. El contenido (INSTRUCTOR)

`/contenido/temas`: un tema por lección, Markdown con imágenes (con alt), video de Vimeo
(con transcripción WebVTT) y PDF (con alternativa textual). Marcar «Se completa con
actividad» solo si un instructor va a revisar algo. Vista previa → publicar.
`/contenido/examenes`: preguntas, clave de respuestas aparte, reglas del intento
(intentos, tiempo, umbral, qué ve el estudiante después). Publicar.

## 4. Las personas (OPERATIONS)

`/personas`: crear con documento, correo y **fecha de nacimiento** (sin ella no se puede
matricular). Menores: registrar el acudiente antes de matricular. Importar por CSV desde
`/cohortes/[id]/importar` cuando son muchos (plantilla en la pantalla).

### Registro público (Fase B)

La persona también puede darse de alta sola en `/registro` (enlace en la portada y en el
login): nombre, apellido, correo, teléfono, fecha de nacimiento y contraseña. Si en
`/admin/institucion` → «Registro público» hay una **cohorte de introducción** elegida,
queda matriculada en el acto; si no, o si es menor de edad (necesita acudiente), la cuenta
se crea y operación la matricula desde `/cohortes/[id]`. La clave «nombre + dos últimos
dígitos de la cédula» **no** existe: se adivina en dos intentos y usa un dato personal; el
equivalente es el enlace de invitación (7 días).

## 5. La cohorte (OPERATIONS)

`/cohortes` → «Nueva cohorte» (programa, código, fechas, progresión lineal o libre, aliado
si lo hay). Matricular (una a una o CSV). **Abrir** la cohorte: es lo que asigna los temas
y exámenes publicados y deja entrar. Invitar (`Invitaciones` → «Preparar el envío»).
Programar sesiones en vivo si las hay.

## 6. La cartera (OPERATIONS)

`/cartera` → cada matrícula → «Crear el plan» (quién paga, total, cuotas, primer
vencimiento). Los pagos se registran en dos pasos; los acuerdos con vista previa.

## 7. Durante la cohorte

- `/cohortes/[id]/avance`: quién va cómo, en riesgo, exportar.
- `/cohortes/[id]/actividades`: aprobar o devolver con comentario.
- `/cohortes/[id]/matriculas/[m]`: progreso, marcar completado a mano (con motivo), ajustes
  razonables (coordinación de inclusión), constancias.
- `/notificaciones`: lo que pide atención.

## 8. Al terminar

Las constancias se emiten solas. Cerrar la cohorte cuando pase `endsOn`. Prorrogar el
acceso a quien lo necesite desde la ficha de la cohorte.

## Lo que operaciones no puede hacer (y quién sí)

Cambiar una nota (se deriva del intento; no hay pantalla), suspender el acceso por mora
(no existe), ver ajustes razonables (coordinación de inclusión), anonimizar (ADMIN).
