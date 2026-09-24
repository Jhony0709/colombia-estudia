# Cargar el primer componente: «Gestión emocional y riesgos psicosociales»

Paso a paso para pasar el documento de los clientes (23/9) a la plataforma, con la
estructura que describieron en la nota de voz del 24/9: video de introducción → talleres →
actividades → aspectos a reflexionar → cuestionario → cierre. Escrito el 24/9; las
pantallas son las de esa fecha. Antes de empezar: base migrada (`pnpm prisma migrate
deploy`) y, si se limpió con `prisma/scripts/reset-datos-sin-usuarios.sql`, sesión de
administración con dos pasos.

## 0. Preparar el texto

Del documento salen estas piezas, en este orden:

| Pieza                                                                                        | Tipo en la plataforma                                     | Se completa con  |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| Introducción al componente (video ≤ 1 min; mientras llega, el texto «Aprender es avanzar»)   | Tema de lectura (con el video cuando exista)              | Lectura          |
| Taller 1 · Gestión de emociones (qué son, principales, cómo reconocerlas, cómo gestionarlas) | Tema de lectura                                           | Lectura          |
| Taller 1 · Riesgos psicosociales y estrés (riesgos, contextos, estrés)                       | Tema de lectura                                           | Lectura          |
| Taller 1 · Conflictos, redes de apoyo y cuidado personal (+ «Aspectos a reflexionar»)        | Tema de lectura                                           | Lectura          |
| Actividad práctica 1 «Un día difícil»                                                        | Tema con actividad, cinco preguntas                       | Entrega revisada |
| Actividad práctica 2 «Carta a mí mismo/a»                                                    | Tema con actividad, cuatro preguntas                      | Entrega revisada |
| Cuestionario de autoevaluación (10 preguntas, clave)                                         | Examen del componente                                     | Presentarlo      |
| Texto de cierre                                                                              | Ya está en la plataforma (pantalla del intento entregado) | —                |

El taller partido en tres temas porque son unas 2.500 palabras: en un celular es demasiado
para un solo tema. Arreglar antes de pegar: la frase cortada «Es por eso que existe el» de
la introducción, y en el cuestionario no incluir las respuestas en el enunciado.

## 1. Asignatura

Contenido → Asignaturas → «Nueva asignatura»: nombre «Bienestar y desarrollo personal»,
código «BDP». Todo tema pertenece a una asignatura; con una basta para este componente.

## 2. Programa y componente

Contenido → Programas → «Nuevo programa»: nombre «Introducción», código «INTRO»,
descripción «Componente de introducción, gratuito», días de acceso por defecto (por
ejemplo 365). Guardar.

En la fila del programa, abrir el chevron y en «Nombre del nuevo componente» escribir
«Gestión emocional y riesgos psicosociales» → «Añadir». Es el componente 1 del programa.

## 3. Temas de lectura (cuatro)

Contenido → Temas → «Nuevo tema», por cada uno: título, programa «Introducción», componente
«Gestión emocional…», asignatura «BDP», y **sin** marcar «Este tema se completa con una
actividad revisada». Crear.

En el editor de cada tema, pegar el texto por bloques (párrafos, listas, encabezados). Los
encabezados no pueden saltar niveles (`##` y luego `###`, nunca `####` directo). Guardar el
borrador y **Publicar**; la publicación valida y dice qué falta.

Para el video de introducción: subirlo a Vimeo, y en el editor pegar la dirección
`https://vimeo.com/…` en un bloque vacío: se convierte en bloque de video. En el engranaje
del bloque cargar los subtítulos revisados o la transcripción; sin eso, **la publicación
rechaza el video** (regla no negociable de accesibilidad). Hasta que el video exista, el
tema de introducción se publica solo con texto y se le añade el video después (nueva
versión, y luego «Contenido añadido» en la cohorte, paso 7).

## 4. Temas con actividad (dos)

«Nuevo tema» igual que arriba, pero marcando «Este tema se completa con una actividad
revisada». En el editor, el contenido es el enunciado del caso (Carlos, 28 años…) o la
consigna de la carta.

En la sección «Actividad» del tema: instrucciones cortas («Responde cada pregunta con tus
palabras»), «Qué entrega» = **Texto**, y en «Preguntas para responder en la plataforma»
añadir cada pregunta del documento («¿Qué emociones podría estar experimentando Carlos?»…).
El estudiante verá un campo por pregunta y no podrá enviar hasta responder todas. Guardar
la actividad y publicar el tema.

Recomendación de producto (no es una regla de la plataforma): en la consigna, pedir que no
incluyan diagnósticos ni datos de otras personas; las respuestas quedan en la base y las
lee el instructor.

## 5. El cuestionario

Contenido → Exámenes → «Nuevo examen»: título «Cuestionario de autoevaluación», tipo
**Parcial**, programa «Introducción», componente «Gestión emocional…», y en «Examen del
tema» elegir **«Del componente (al final)»** para que vaya después de todos los temas.

En el editor del examen: reglas (intentos permitidos, porcentaje para aprobar, tiempo si
lo hay, qué ve el estudiante al terminar) y las diez preguntas como «respuesta única» con
sus cuatro opciones; marcar la correcta en la clave (1B, 2C, 3B, 4A, 5C, 6D, 7C, 8C, 9A,
10C). Sugerencia: variar la posición y el largo de la opción correcta, porque en el
documento casi siempre es la más larga. Publicar.

## 6. Ver la ruta

Contenido → Programas → «Construir la ruta» del programa «Introducción»: el orden que
recorrerá el estudiante. Debe quedar: introducción, tres talleres, actividad 1, actividad
2, cuestionario. Reordenar con subir/bajar si hace falta.

## 7. Cohorte

Operación → Cohortes → «Nueva cohorte»: programa «Introducción», código (por ejemplo
«INTRO-2026»), nombre, fecha de inicio (hoy) y de fin (lejana: es la cohorte de todo el
que se registre). Crear.

En la cohorte: «Añadir contenido» toma las versiones publicadas del programa y las congela
para la cohorte (cada tema queda asignado a su versión). Después «Abrir la cohorte»: la
apertura revisa que la ruta esté completa.

## 8. Que el registro matricule aquí

Administración → Institución → «Registro público» → «Cohorte de introducción»: elegir
«INTRO-2026» y guardar. Desde ese momento, quien se registre en `/registro` entra a
estudiar en el acto (mayores de edad; un menor se crea sin matrícula y operación lo
matricula con su acudiente).

## 9. Probar como estudiante

Registrar una cuenta de prueba en `/registro`, entrar y recorrer: «Empieza por aquí» →
introducción → talleres → actividad (responder las preguntas, enviar) → desde la sesión de
staff, Cohortes → Actividades → aprobar → cuestionario → «Aprender es avanzar» → «Seguir con
el siguiente paso». Al aprobar todo, el componente se completa y se emite la constancia
del componente.

## Qué no hace la plataforma todavía

- Un video de introducción distinto por componente sin tema: hoy el video va en un tema.
- «Aspectos a reflexionar» como pieza propia: va como cierre del último taller.
- El cierre del cuestionario es un texto general para toda la plataforma, no por componente.
