# Propuesta comercial — Plataforma académica Valida YA

**Colombia Estudia · Diseño, desarrollo y puesta en marcha de la plataforma académica de
Valida YA (Bachillerato en corto tiempo)**

> Documento para el cliente. Los supuestos internos y los espacios por confirmar están al
> final, marcados con ⟦ ⟧. Estructura espejo de la propuesta que Valida YA recibió de un
> tercero (LMS en WordPress, 16 semanas), para que la comparación sea punto por punto.

---

## 1. Presentación

Valida YA opera hoy sobre WordPress + LearnDash: un curso por cohorte, clonado para cada
aliado; contenido en imágenes de PDF y videos en Vimeo; progreso que es un clic en "marcar
como completado"; cartera fuera de la plataforma; y sin herramientas para el cumplimiento
de ajustes razonables ni de accesibilidad.

Esta propuesta no es reemplazar un LMS por otro LMS. Es construir la plataforma de
Valida YA sobre un modelo que entiende el negocio —un programa, muchas cohortes, algunas
de aliados, estudiantes adultos que estudian desde el celular— y que produce, sola, la
evidencia que hoy nadie tiene: qué aprendió cada estudiante, quién está al día, qué
ajustes se aplicaron y a quién.

## 2. Nuestra solución

Una plataforma propia, a medida, en la que Valida YA administra desde un solo lugar el
programa, las cohortes, los estudiantes, los aliados, el contenido, las evaluaciones, las
clases en vivo, los certificados y la cartera.

Principales funcionalidades:

- Programa con módulos, temas y evaluaciones **versionados**: se corrige una vez y todas
  las cohortes lo reciben; lo que un estudiante ya vio no cambia bajo sus pies.
- Cohortes propias y de aliados sobre el **mismo contenido**, sin clones.
- Contenido en texto real (no imágenes), con fórmulas, imágenes descritas, videos de
  Vimeo con transcripción, y biblioteca de recursos descargables.
- **Progreso con evidencia**: el tema se completa cuando el estudiante lo estudió, no
  cuando pulsó un botón.
- Evaluaciones automáticas por asignatura con intentos, tiempo, umbral de aprobación y
  revisión de resultados; diagnóstico inicial.
- **Entregables prácticos** con revisión del instructor.
- **Clases en vivo** (Zoom, Meet) en el calendario del estudiante, con recordatorio.
- **Certificados automáticos** por módulo y constancia final del programa, con código
  público de verificación.
- **Ajustes razonables (PIAR)** que el sistema aplica solo: tiempo adicional, intentos
  extra, sin cronómetro, subtítulos obligatorios. Reporte de cumplimiento del Decreto
  1421 de 2017.
- **Cartera**: planes de pago por cuotas, pagos manuales (transferencia, Bre-B, efectivo) y
  **en línea** (tarjeta, PSE, Nequi vía Wompi), acuerdos de pago, estado de cuenta, y
  recordatorios automáticos. Cartera por aliado cuando el aliado paga.
- Paneles para estudiante, operaciones, instructores, aliados y administración.
- Reportes con fórmula (finalización, avance con evidencia, en riesgo, cartera) y
  exportación a Excel por cohorte y por aliado.
- Correos y notificaciones automáticas (invitaciones, recordatorios, calificaciones,
  clases, certificados).
- **Accesibilidad WCAG 2.2 AA**: para lector de pantalla, teclado, celular de gama media
  y datos limitados. Verificada en cada entrega, y en el contenido, no solo en el código.
- Dominio propio de Valida YA, diseño responsive, en español de Colombia.

## 3. Alcance del proyecto

**Infraestructura tecnológica**

- Hosting en Vercel y base de datos en Supabase (Postgres) con copias de seguridad diarias.
- Dominio propio, SSL, protección contra abuso, entornos de pruebas y producción separados.
- Monitoreo de errores desde el primer día.
- Almacenamiento privado de archivos; videos en la cuenta de Vimeo de Valida YA (se
  conservan los actuales).

**Plataforma académica**

- Programa, módulos, asignaturas, temas y evaluaciones versionados.
- Cohortes con fechas, progresión lineal, vencimiento de acceso, matrículas y su ciclo
  (retiro, prórroga, completado).
- Diagnóstico inicial, evaluaciones por asignatura, entregables, certificados.
- Ajustes razonables por estudiante y reporte de cumplimiento.

**Gestión de contenido**

- Migración del contenido actual de LearnDash (temas, videos, evaluaciones y preguntas).
- Conversión asistida del contenido en imagen a texto real, con alternativa textual
  automática desde el primer día.
- Editor para nuevos temas con validación de accesibilidad al publicar.
- Biblioteca de recursos y calendario académico.

**Experiencia del usuario**

- Panel del estudiante: mi cohorte, tema a tema, evaluaciones, resultados, calendario,
  biblioteca, certificados, mi cuenta.
- Panel de operaciones: cohortes, personas, matrículas por CSV, invitaciones, cartera,
  acuerdos, aliados, entregas por revisar.
- Panel del aliado: avance de su cohorte y exportación.
- Administración: programa, marca, políticas, auditoría.

**Automatización**

- Invitaciones y recuperación de contraseña.
- Recordatorios de cuotas, clases en vivo y vencimientos.
- Emisión de certificados al completar.
- Conciliación de pagos en línea.

**Cartera y pagos**

- Planes por cuotas, pagos manuales y en línea, acuerdos de pago, estado de cuenta,
  cartera por aliado.

## 4. Inversión y entregables

El proyecto incluye:

- Diseño e implementación completa de la plataforma (sin plantillas ni plugins de terceros
  que se rompan con una actualización).
- Migración del contenido actual y de la estructura del programa.
- Configuración de roles, permisos, cohortes y aliados.
- Integraciones: Vimeo, Wompi, correo transaccional, videoconferencia (enlace).
- Sistema de evaluaciones, entregables y certificados.
- Cartera con pagos manuales y en línea.
- Paneles por rol y reportes exportables.
- Verificación de accesibilidad WCAG 2.2 AA con evidencia por entrega.
- Capacitación a operaciones y a autores de contenido; manuales.
- Acompañamiento durante la puesta en marcha y la primera cohorte.
- **Propiedad del contenido**: los temas quedan en texto plano (Markdown) exportable en
  cualquier momento. Sin dependencia de un proveedor para leer lo que es suyo.

## 5. Tiempo estimado de ejecución

**20 semanas**, en cinco hitos verificables. Depende de la entrega del acceso al contenido
actual (copia de la base de datos de WordPress y exportación) en la semana 1 y de la
revisión del cliente en cada hito.

## 6. Cronograma

| Semanas | Fase                             | Actividades principales                                                                                                                                                          | Entregable                                                                         |
| ------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1-3     | Fundaciones                      | Arquitectura, entornos, dominio, modelo de datos, reglas del negocio con pruebas automáticas, autenticación e invitaciones, sistema de diseño accesible                          | Plataforma desplegada en pruebas con institución demo; reglas del negocio probadas |
| 4-5     | Institución, cohortes y personas | Programa, cohortes, personas, matrículas por CSV, invitaciones, notificaciones, auditoría                                                                                        | Operaciones puede crear una cohorte y matricular desde un archivo                  |
| 6-9     | Contenido y migración            | Editor accesible, biblioteca, importación del contenido de LearnDash, conversión asistida a texto, videos de Vimeo, evaluaciones y preguntas                                     | Todo el programa actual dentro de la plataforma, revisado                          |
| 10-13   | Aprender y evaluar               | Panel del estudiante, tema a tema con evidencia, evaluaciones con intentos y tiempo, ajustes razonables, entregables, clases en vivo, calendario, certificados, panel del aliado | Un estudiante recorre el programa completo de punta a punta                        |
| 14-15   | Cartera                          | Planes, cuotas, pagos manuales y en línea (Wompi), acuerdos, estado de cuenta, recordatorios                                                                                     | Cartera operando con pagos reales en modo prueba                                   |
| 16-18   | Endurecer y validar              | Pruebas automáticas de punta a punta, accesibilidad con lector de pantalla y teclado, seguridad, respaldo y restauración, correcciones                                           | Plataforma validada; acta de aprobación funcional                                  |
| 19      | Capacitación y corte             | Capacitación, manuales, importación definitiva del contenido, apertura de la primera cohorte en la plataforma                                                                    | Equipo capacitado; primera cohorte matriculada                                     |
| 20      | Salida a producción              | Publicación, monitoreo, estabilización, cierre                                                                                                                                   | Plataforma en producción y operativa                                               |

## 7. Etapas y resultados esperados

| Etapa | Semana | Resultado                                                             |
| ----- | ------ | --------------------------------------------------------------------- |
| 1     | 3      | Fundaciones probadas; diseño del sistema y pantallas clave aprobados  |
| 2     | 9      | Contenido actual migrado y revisado dentro de la plataforma           |
| 3     | 13     | Recorrido completo del estudiante validado por Valida YA              |
| 4     | 15     | Cartera y pagos en línea operando en pruebas                          |
| 5     | 20     | Plataforma en producción, equipo capacitado, primera cohorte en curso |

## 8. Lo que le ofrecían y lo que entregamos

|                       | Propuesta LMS en WordPress                  | Colombia Estudia                                                                                                |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Plataforma            | WordPress + LearnDash + plugins de terceros | Desarrollo propio, sin plugins que se rompan al actualizar                                                      |
| Cohortes y aliados    | Cursos clonados por cohorte                 | Un contenido, todas las cohortes; aliados con panel propio y cartera aparte                                     |
| Contenido             | Imágenes y PDFs subidos                     | Texto real, fórmulas, imágenes descritas, biblioteca; exportable en Markdown                                    |
| Videos protegidos     | Sí                                          | Sí, en la cuenta de Vimeo de Valida YA, con transcripción                                                       |
| Clases en vivo        | Zoom                                        | Zoom/Meet en el calendario, con recordatorio y grabación como recurso                                           |
| Evaluaciones          | Automáticas por puntaje                     | Automáticas, con intentos, tiempo, umbral, diagnóstico, y **ajustes razonables aplicados solos**                |
| Entregables prácticos | Sí                                          | Sí, con revisión, comentarios y reenvío                                                                         |
| Progreso              | "Marcar como completado"                    | Con evidencia (video visto, texto leído, entrega aprobada)                                                      |
| Certificados          | Automáticos por módulo y final              | Automáticos por módulo y final, con **código público de verificación**                                          |
| Paneles               | Estudiante, tutor, admin                    | Estudiante, operaciones, instructor, **aliado**, administración                                                 |
| Reportes              | Reportes académicos                         | Métricas con fórmula, en riesgo, cartera, cumplimiento del Decreto 1421; **exportables por cohorte y aliado**   |
| Correos automáticos   | Sí                                          | Sí, más centro de notificaciones en la plataforma                                                               |
| Pagos                 | Tarjeta, débito, PSE                        | Tarjeta, PSE, Nequi (Wompi) **y** transferencia/Bre-B sin comisión; acuerdos de pago; estado de cuenta          |
| Cartera               | No                                          | Planes por cuotas, acuerdos, cartera por aliado, sin bloquear nunca a un menor por mora                         |
| Accesibilidad         | No mencionada                               | **WCAG 2.2 AA**, verificada en cada entrega y en el contenido                                                   |
| Inclusión (PIAR)      | No                                          | Ajustes por estudiante aplicados por el sistema; reporte de cumplimiento                                        |
| Seguridad             | Firewall y SSL                              | Aislamiento por institución, respuestas correctas separadas, auditoría de cada cambio, anonimización (Ley 1581) |
| Sitio institucional   | Home, Nosotros, FAQ…                        | validaya.com sigue como sitio público; la plataforma vive en su propio dominio                                  |
| Tiempo                | 12-16 semanas                               | 20 semanas, con cinco hitos verificables                                                                        |
| Propiedad             | Sitio en WordPress                          | Contenido exportable; plataforma bajo licencia                                                                  |

## 9. Valor del proyecto

| Concepto                                                                                                 | Valor                                                                   |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Implementación (diseño, desarrollo, migración, capacitación, puesta en marcha)                           | ⟦ $ __________ COP ⟧                                                    |
| Licencia mensual (hosting, respaldos, monitoreo, soporte, evolutivos, hasta ⟦ 300 ⟧ estudiantes activos) | ⟦ $ __________ COP / mes ⟧                                              |
| Comisión de pagos en línea (Wompi, 2,65 % + $700 + IVA por transacción)                                  | La asume ⟦ Valida YA / el estudiante ⟧; transferencia y Bre-B sin costo |
| Facturación electrónica DIAN, integración con proveedor                                                  | Cotización aparte, fase posterior                                       |

Forma de pago: ⟦ 40 % al inicio, 30 % al hito 3, 30 % a la salida a producción ⟧. La
licencia inicia con la salida a producción.

**Propiedad intelectual**: la plataforma es de Colombia Estudia y se entrega bajo licencia
de uso; el contenido, los datos y su exportación son de Valida YA en todo momento.

---

## Supuestos internos (no van al cliente)

- 20 semanas supone dedicación cercana a tiempo completo. En paralelo con Basikon son
  ~40 semanas: fijar el calendario del cliente solo después de decidir la dedicación.
- Precio de referencia (9/9): implementación $15-25 M COP como socio de diseño, licencia
  $500-800 k COP/mes. El alcance creció con la paridad (entregas, sesiones, certificados,
  Wompi): revisar hacia arriba o cobrar la paridad como fase 1.1.
- Comparable de mercado para la licencia: Q10 Básico $920 k + $4 k/estudiante/mes (solo
  parte administrativa).
- Título de bachiller: lo expide quien tenga la autorización legal; la plataforma emite
  constancias. Decirlo en la capacitación y en el pie del certificado.
- Contrato: licencia de uso + encargo de tratamiento de datos (Ley 1581) + cláusula de
  propiedad intelectual. Revisar con abogado antes de firmar.
