# Análisis de la plataforma actual — validaya.com (WordPress + LearnDash)

Levantado el 14/9/2026 navegando el wp-admin. Sin datos personales: aquí solo hay
estructura, conteos y configuración. Los nombres y correos de estudiantes que aparecen en
el dashboard de LearnDash **no se copian a ningún documento**.

## Qué es el negocio

**"Valida YA — Bachillerato en corto tiempo"**: programa de bachillerato acelerado
(validación), en cohortes de ~6 meses, vendido directo y a través de aliados. No es un
colegio de grados y grupos: es un **programa con cohortes**.

## Stack actual

WordPress en SiteGround, LearnDash LMS, Elementor, WooCommerce (instalado; 0 ventas en el
curso principal), LoginPress, un plugin de afiliados, "Fragmentos de código".

## Estructura del contenido

```
Curso "Bachillerato Valida YA 2026"          (LearnDash course, 132 pasos, progresión LINEAL)
├── DIAGNÓSTICO
│   └── Formulario de Diagnóstico            (lección) → 1 cuestionario "Diagnóstico inicial"
├── MÓDULO MES 1 … MÓDULO MES 6              (secciones)
│   └── Español 1, Literatura, Inglés 1, Sociales 1, Ciencias Políticas, Matemáticas 1,
│       Economía 1, Español 2, Sociales 2, Inglés 2, Economía 2, Matemáticas 2, Español 3,
│       Cátedra de Paz, Economía 3, Geometría 1, Física, Sociales 3, Ciencias Naturales,
│       Cátedra de Paz 2, Cátedra de Vida        (22 lecciones = asignaturas; sin contenido propio)
│       └── 110 temas                             (el contenido real: 1 a 11 por asignatura)
└── FINAL: 5 cuestionarios de asignatura (Español 1, Literatura, Español 2, Sociales 2, Inglés 2)
```

Un segundo curso, **"Bachillerato Valida YA 2026 ValoraT"**, es un **clon** del anterior
(mismas lecciones, mismos cuestionarios duplicados con otros ids) para un aliado. Total:
220 temas, 13 cuestionarios, 239 preguntas en el sitio. Un tercer curso gratuito,
"Introducción Valida Ya!", con un cuestionario de Inteligencia Financiera.

## Cómo es un tema

Tres formas vistas:

1. **Página de PDF como imagen** (ej. "Física – Magnitudes Escalares y Vectoriales"): el
   contenido es una imagen diseñada ("TEMA 3", franjas rojas) con el texto dentro de la
   imagen. **No hay texto real**: no es indexable, no lo lee un lector de pantalla y no se
   puede adaptar.
2. **Video de Vimeo** (ej. "Sociales – Presentación Docente"): un bloque `figure` con un
   `iframe` de `player.vimeo.com`. La búsqueda de "video" en temas devuelve **130 de 220**.
   No hay ningún video en la biblioteca de medios de WordPress: todo está en Vimeo.
3. **Temas "ACTIVIDAD"** (ej. "Física – ACTIVIDAD Magnitudes"): ejercicios, presumiblemente
   también como imagen.

La función "progreso de video" de LearnDash está apagada; completar un tema es pulsar
**"Marcar como completado"**. No hay evidencia de consumo.

## Evaluación

| Cuestionario        | Preguntas (muestra) | Tipo dominante  | Puntos |
| ------------------- | ------------------- | --------------- | ------ |
| Diagnóstico inicial | —                   | Respuesta única | 1 c/u  |
| Inglés 2            | 12                  | Respuesta única | 1 c/u  |

239 preguntas en total; en la muestra, todas de **respuesta única**. LearnDash ofrece
además múltiple, ordenación, rellenar, ensayo; no se verificó cuántas de esas hay.

## Cohortes (LearnDash Groups)

15 grupos, nombrados por periodo y a veces por aliado: `2022-2`, `2023-1`, `2023-3`,
`2023-4 Viva`, `2024-1`, `2024-2`, `2025-1`, `2025-1 Valida Ya`, `2025-1 ValoraT`,
`2025 Gustavo Restrepo`, `2025-2` (58 usuarios), `2025-3` (12), `2025-4` (16),
`2026-1 ValoraT` (18), `2026` (16). **Ningún grupo tiene líderes.**

Es decir: **varias cohortes al año, algunas de aliados (B2B)**. La cohorte es la unidad
comercial y académica.

## Usuarios

422 en total: 8 administradores, 121 suscriptores, 288 "Cliente" (rol de WooCommerce),
6 afiliados. **No existe rol de profesor**: todo lo opera el administrador. El curso
principal reporta 100 inscritos: 30 % completado, 23 % en progreso, 47 % sin empezar.

## Configuración comercial del curso principal

Modo de inscripción **cerrado** (se inscribe a mano o por grupo). Precio listado 80.000,
con "5 pagos recurrentes" configurado pero sin uso (0 ventas). Acceso expira a los
**300 días**. Contenido visible solo para inscritos. Sin certificado configurado.

## Lo que esto cambia en el modelo que teníamos

| Supuesto del modelo (9-14/9)                            | Realidad                                                      | Cambio                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Colegio con grados, grupos y año lectivo                | Programa con cohortes de ~6 meses                             | `AcademicYear/GradeLevel/Group/Term` → `Program/Module/Cohort`                  |
| Estudiantes menores con acudiente                       | Mayoría adultos (bachillerato acelerado); puede haber menores | `Guardianship` y `Consent` del acudiente pasan a **opcionales según edad**      |
| "Pensión" mensual por año lectivo                       | Cuotas de un programa; a veces paga un aliado                 | `PaymentPlan` por matrícula; `Organization` como responsable financiero posible |
| Profesores autores y calificadores                      | Solo administradores                                          | El rol `TEACHER` existe pero el MVP no depende de él                            |
| Video secundario                                        | **Video central (Vimeo, 130 temas)**                          | `MediaAsset.provider = VIMEO` es el proveedor del MVP, no Storage               |
| Contenido en texto                                      | Imágenes de PDF sin texto                                     | La migración necesita una decisión: transcribir o marcar legado                 |
| Regla de mora basada en SU-624/99 (menores en colegios) | Adultos en un programa privado                                | **La regla cambia y hay que verificarla con abogado**: ver abajo                |

## Sobre la mora, revisado

La jurisprudencia que fundamentó "la mora nunca toca el acceso" (SU-624/99, T-666/13)
protege a **menores en colegios**. Para un adulto en un programa educativo privado la
relación es más contractual y la restricción de acceso por no pago es, en principio, más
defendible — pero **no está verificado** y para los menores que sí haya en una cohorte la
regla original aplica íntegra.

Diseño propuesto mientras un abogado responde: `RestrictionPolicy` sigue existiendo con
sus flags no académicos; se **puede** añadir `suspendContentAccessForAdults`, que solo
aplicaría a matrículas de mayores de edad y nunca a menores, **pero no se implementa hasta
que Jhonny lo confirme con asesoría jurídica**.

## Migración (para el roadmap)

> **Superado el 14/9 por la decisión 1** (solo cohortes nuevas): se migra **contenido**, no
> personas ni progreso. Los dos últimos puntos de esta lista quedan como referencia
> histórica; la fuente vigente es `ROADMAP.md` fase 3 y 6.

- Vimeo: conservar los mismos ids; `MediaAsset { provider: VIMEO, providerRef }`. Verificar
  que el plan de Vimeo permita restringir el embed al dominio nuevo.
- Temas-imagen: 110 por curso. Opciones: (a) OCR + revisión humana para convertirlos en
  texto real (accesible, indexable, adaptable); (b) importarlos como imagen con
  `legacy: true` y `alt` descriptivo mínimo, y convertir por lotes después. La validación
  de publicación no debe bloquear la migración: se publica el legado con una excepción
  explícita y auditada, y la regla estricta aplica a contenido nuevo.
- Cuestionarios: exportar preguntas de LearnDash (ProQuiz) a nuestro JSON. Tipo
  `single_choice` cubre la muestra.
- Usuarios: 100 activos; el resto son históricos. Importar personas y matrículas por
  cohorte desde CSV; no migrar contraseñas (invitación nueva).
- Progreso: LearnDash guarda "completado" por tema. Se puede importar como
  `LessonProgress` con `completedAt` y sin evidencia.
