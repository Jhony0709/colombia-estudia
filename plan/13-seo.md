# 13 — SEO y páginas públicas

## Objetivo

Que quien busca en Google cómo terminar el bachillerato en Bogotá encuentre a ALBA, entienda
su caso y escriba por WhatsApp o se registre. Se mide con búsquedas reales (Search Console)
y con contactos que llegan desde Google, no con «posiciones» sueltas.

## Punto de partida (evidencia, 9/11/2026)

| Qué                 | Dato                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search Console      | 2 impresiones, 0 clics, sin consultas con datos (Rendimiento, 3 meses). El sitio es nuevo para Google.                                               |
| Indexadas           | 4: `/`, `/registro`, `/auth/login`, `/politica-de-datos`, las mismas del sitemap (`apps/web/app/sitemap.ts:7`).                                      |
| «Sin indexar»       | 3, todas «Página con redirección»: `www.` y `http://`. Es lo esperado; no se corrige.                                                                |
| Datos estructurados | `EducationalOrganization` y `WebSite` (`features/marketing/structured-data.tsx:13`, `:22`).                                                          |
| Portada             | Un programa (bachillerato acelerado) y FAQ con 6 preguntas (`messages/es-CO.json`, `landing.*`); textos fijos (`features/marketing/content.ts:1-6`). |
| Rutas públicas      | Lista cerrada: `PUBLIC_EXACT` y `PUBLIC_PREFIXES` (`lib/authz/routes.ts:18-43`). **Una página nueva que no esté ahí redirige al login.**             |
| Robots              | Producción rastreable salvo `/api/`; preview y staging, bloqueados (`app/robots.ts:6-11`).                                                           |
| Analítica           | No hay (ni GA4 ni Vercel Analytics en `package.json` o `app/layout.tsx`).                                                                            |
| Markdown            | Ya existe un render saneado: `renderLessonHtml` (`packages/types/src/render.ts:484`).                                                                |

## Decisiones (9/11)

1. **Bogotá primero.** Menos volumen que «virtual» a nivel país, pero se gana antes: hay
   menos competencia seria con contenido propio y Google mezcla resultados locales.
   Lo nacional (virtual) es la fase 4.
2. **Sin precio, institución aliada ni testimonios por ahora.** Se planea sin ellos y quedan
   en «Pendientes que frenan». En educación (tema YMYL para Google) son las señales de
   confianza que más pesan; sin ellas, el contenido tiene que compensar con exactitud y
   fuentes.
3. **Páginas en el repo, no en un CMS.** Las páginas pilar son rutas de Next con su copy en
   `messages/es-CO.json` (convención de la portada). Las guías largas son Markdown en
   `apps/web/content/guias/*.md` renderizado con `renderLessonHtml`: sin dependencias nuevas
   ni tocar `next.config.ts`.
4. **Honestidad como estrategia.** Explicamos también las alternativas (validación del ICFES,
   ciclos gratuitos de la SED). Quien compara confía en quien le explica todo; y Google premia
   la página que mejor resuelve la duda, no la que más vende.

## Lo que la gente busca (mapa de intención)

Los volúmenes **no están medidos**: el paso 0.1 los saca de Keyword Planner y, con el
tiempo, de Search Console. Las consultas de ejemplo son hipótesis a confirmar.

| Grupo                    | Ejemplos de búsqueda                                                                                 | Intención           | Página destino                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| Local, decidir           | bachillerato para adultos Bogotá · terminar el bachillerato en Bogotá · colegio para adultos Bogotá  | Contratar           | `/bachillerato-para-adultos-bogota`           |
| Modalidad                | bachillerato por ciclos Bogotá · bachillerato acelerado · CLEI adultos · cuántos ciclos son          | Entender y comparar | `/bachillerato-por-ciclos`                    |
| «Validar»                | validar el bachillerato · validar bachillerato Bogotá · validación ICFES vs por ciclos               | Entender (mezcla)   | `/validar-el-bachillerato`                    |
| Requisitos               | requisitos para terminar el bachillerato · certificado del último grado aprobado · edad para validar | Resolver un trámite | `/requisitos`                                 |
| Dudas de confianza       | el bachillerato acelerado es legal · título válido · Decreto 3011 · cuánto dura                      | Quitar miedo        | `/preguntas-frecuentes` + guías               |
| Situaciones de vida      | estudiar y trabajar · retomar el bachillerato a los 40 · terminar el bachillerato siendo mamá        | Sentirse capaz      | Guías                                         |
| Gratis (competencia SED) | validar bachillerato gratis Bogotá · matriculatón                                                    | Opción pública      | Sección honesta en `/validar-el-bachillerato` |
| Marca                    | ALBA Futuro Educativo · ALBA bachillerato                                                            | Navegar             | `/`                                           |

Hechos que el contenido debe respetar (verificados 9/11/2026):

- **Validación del ICFES**: un examen de cinco áreas, 18 años cumplidos, dos convocatorias al
  año ([calendariodecolombia.com, 17/6/2026](https://www.calendariodecolombia.com/educacion/como-validar-el-bachillerato-en-colombia-y-requisitos-para-presentar-el-examen-de-validacion-ante-el-icfes)).
- **Ciclos (CLEI)**: Decreto 1075 de 2015, que compila el 3011 de 1997. Básica: 13 años o más
  sin primaria, o 15 o más con primaria y dos años fuera (art. 2.3.3.5.3.4.2); cuatro CLEI
  (art. 2.3.3.5.3.4.4). Media: 18 años o más con noveno, o con el certificado de bachillerato
  básico; dos CLEI de al menos 22 semanas (art. 2.3.3.5.3.5.1)
  ([normograma Cancillería](https://cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1075_2015_pr017.htm)).
- **SED Bogotá**: hay oferta gratuita por ciclos (p. ej. la «Matriculatón» de enero de 2026,
  presencial) ([Noticias RCN, 26/1/2026](https://www.noticiasrcn.com/economia/matriculaton-bogota-abre-inscripciones-para-validar-el-bachillerato-en-2026-984630)).

## Arquitectura de URLs

Pocas páginas, cada una dueña de una intención. Nada de una página por localidad con el mismo
texto (Google lo trata como _doorway pages_).

| URL                                  | Rol                                    | Fase |
| ------------------------------------ | -------------------------------------- | ---- |
| `/`                                  | Marca + entrada a los pilares          | 1    |
| `/bachillerato-para-adultos-bogota`  | Pilar local (la página que vende)      | 1    |
| `/bachillerato-por-ciclos`           | Pilar de modalidad (ciclos ↔ grados)   | 1    |
| `/requisitos`                        | Documentos y edades, paso a paso       | 1    |
| `/preguntas-frecuentes`              | Todas las dudas, con respuestas cortas | 1    |
| `/contacto`                          | Nombre, dirección, teléfono, horario   | 1    |
| `/validar-el-bachillerato`           | Guía comparativa: ICFES, ciclos, SED   | 2    |
| `/guias` y `/guias/[slug]`           | Contenido informacional                | 2    |
| `/bachillerato-virtual-para-adultos` | Pilar nacional                         | 4    |

Enlazado interno: cada guía enlaza a su pilar con un texto descriptivo; cada pilar enlaza a
2–3 guías y a `/requisitos`; la portada enlaza a los cinco de fase 1 desde el menú y el pie.

## Plantilla de página (lo que cumple cada una)

- `<title>` ≤ 60 caracteres con la búsqueda principal y la marca al final; `description` de
  ~150 con un beneficio y una acción. Un solo `<h1>`.
- **La respuesta primero**: el primer párrafo resuelve la pregunta de la URL; el detalle va
  después. Es lo que Google usa para el fragmento y lo que lee alguien desde el celular.
- `alternates.canonical` propio; Open Graph con imagen.
- JSON-LD: `BreadcrumbList` en todas; `FAQPage` en las que tienen preguntas (ya no da
  resultado enriquecido salvo a sitios de gobierno y salud desde 2023, pero ordena el contenido
  para buscadores y respuestas de IA); `EducationalOrganization` con `address` en `/contacto`.
  No `Course`: Google retiró ese resultado enriquecido en 2025
  ([Search Engine Land](https://searchengineland.com/google-to-drop-support-for-several-rich-result-types-to-simplify-the-search-results-page-456969)).
- Fecha «Revisado el …» visible y quién lo revisó (rol, no hace falta nombre).
- Fuentes enlazadas cuando se cita una norma, una edad o una fecha.
- Dos acciones fijas: WhatsApp con mensaje prellenado propio de la página y «Crear cuenta».
- Mismo sistema visual de la portada (`features/marketing/*`), móvil primero, sin imágenes
  pesadas (LCP < 2,5 s en 4G).

## Fases

### Fase 0 — Medición y base técnica

1. **Investigación de palabras**: Keyword Planner con Bogotá como ubicación para cada grupo del
   mapa; anotar volumen y dificultad en una tabla en este doc. Revisar el top 10 de cada
   búsqueda principal: quién aparece, qué responde, qué le falta.
2. **Registro único de páginas públicas**: `features/marketing/pages.ts` con
   `{ path, lastReviewed }`. De ahí salen el sitemap (`app/sitemap.ts`) y la lista pública
   (`lib/authz/routes.ts`), para que una página nueva no quede detrás del login ni fuera del
   sitemap. Test que compare ambos.
3. **Helper de metadata** (`lib/seo/page-metadata.ts`): título, descripción, canonical, OG.
4. **Componente de JSON-LD** con `BreadcrumbList` y `FAQPage` reutilizables (extiende
   `structured-data.tsx`).
5. **Analítica**: Vercel Web Analytics (sin cookies) o GA4 con consentimiento; decidir en un
   ADR por la Ley 1581 y la política de datos. Mínimo: contar clics a WhatsApp por página
   (`?ref=` o evento).
6. Enviar el sitemap de nuevo en Search Console y pedir indexación de cada página nueva.

**Sale cuando**: el registro alimenta sitemap y rutas públicas con test, y hay una tabla de
volúmenes por grupo.

### Fase 1 — Pilares de Bogotá

1. Portada: `meta.title` a «Bachillerato para adultos en Bogotá | ALBA Futuro Educativo» (o la
   variante que gane en 0.1) y enlaces a los pilares.
2. `/bachillerato-para-adultos-bogota`: para quién es, cómo funciona, cuánto dura según el
   último grado, requisitos en corto, qué título se recibe, dudas, contacto.
3. `/bachillerato-por-ciclos`: tabla CLEI ↔ grados ↔ duración con la norma citada; cómo saber
   en qué ciclo empiezas.
4. `/requisitos`: documentos, edades, cómo pedir el certificado del último grado aprobado
   (incluido si el colegio cerró).
5. `/preguntas-frecuentes`: las 6 de la portada más las que llegan por WhatsApp (sacarlas de
   la bandeja de `/mensajes`).
6. `/contacto` con nombre, dirección y teléfono idénticos en todas partes (web, Google, Meta).

**Sale cuando**: las cinco páginas están indexadas y cada una tiene impresiones en Search
Console para su grupo.

### Fase 2 — Guías (2 al mes)

Primeras, por intención y facilidad:

1. Validar el bachillerato: ICFES, ciclos o colegio virtual, ¿cuál te conviene?
2. Cómo pedir el certificado del último grado aprobado en Bogotá.
3. ¿Cuánto dura terminar el bachillerato por ciclos?
4. ¿El bachillerato acelerado es legal en Colombia?
5. Estudiar y trabajar: cómo organizar la semana.
6. Retomar el bachillerato después de los 30 o 40.

Cada guía: 800–1.500 palabras, respuesta arriba, fuentes, fecha, enlaces al pilar. Se publica
como `content/guias/<slug>.md` con frontmatter (`title`, `description`, `reviewed`).

**Sale cuando**: hay 6 guías y al menos una consulta de cada grupo informacional con clics.

### Fase 3 — Autoridad y presencia local

1. **Perfil de Empresa de Google**: si hay atención presencial en la Cra. 10A # 11-53 Sur, con
   dirección; si no, como empresa de área de servicio (Bogotá) y dirección oculta. Categoría
   educativa, horario, WhatsApp, fotos reales.
2. Mismos datos en directorios serios de educación en Colombia y en Facebook/Instagram.
3. Videos cortos (Remotion, idea del 5/11) que respondan una pregunta cada uno,
   en YouTube e incrustados en la guía correspondiente.
4. Pedir reseñas en Google a quienes terminan (cuando haya egresados).

### Fase 4 — Virtual a nivel nacional

`/bachillerato-virtual-para-adultos` y guías sin ciudad, cuando las páginas de Bogotá ya
tengan clics. Las ciudades siguientes solo con contenido propio de esa ciudad.

## Reglas de contenido

- No inventar cifras, tiempos ni promesas («título en 6 meses») que el programa no pueda
  sostener; todo dato verificable lleva fuente o sale del programa real.
- Mismo vocabulario que la gente: «validar», «terminar», «bachillerato acelerado», aunque el
  término técnico sea «ciclos»; se explica la diferencia sin corregir al lector.
- Revisión cada 6 meses o cuando cambie una norma o una fecha del ICFES; actualizar
  `lastReviewed`.
- Nada de texto generado en masa sin revisión: una página buena vale más que diez delgadas.

## Pendientes que frenan

| Dato                            | Para qué sirve                                                | Dónde se usaría                      |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Precio o rango                  | Búsquedas de costo; quien compara precio no escribe sin verlo | Pilar Bogotá, FAQ                    |
| Institución aliada y resolución | Prueba de que el título es válido (lo que más se pregunta)    | Pilar Bogotá, FAQ, guía de legalidad |
| Testimonios con permiso         | Confianza; reseñas en Google                                  | Pilares, Perfil de Empresa           |
| Razón social y NIT              | Pie de página, Perfil de Empresa, verificación de Meta        | `/contacto`, pie                     |

## Qué queda hecho

Fases 0 y 1: registro de páginas, helper de metadata, JSON-LD, analítica decidida, cinco
pilares indexados y portada retitulada. Fase 2 en marcha con cadencia fija.

## Estado (19/11/2026)

**Hecho en código** (sin desplegar a esa fecha):

- 0.2 Registro único: `lib/seo/pages.ts`. De ahí salen `app/sitemap.ts` y las rutas públicas
  (`lib/authz/routes.ts`); el sitemap ya no promociona `/auth/login`. Test:
  `__tests__/unit/seo/pages.test.ts`.
- 0.3 Helper de metadata: `lib/seo/page-metadata.ts` (título, descripción, canónica, Open Graph
  y tarjeta de Twitter).
- 0.4 JSON-LD: `lib/seo/json-ld.ts` (`WebPage`, `BreadcrumbList`, `FAQPage`). La portada suma
  `FAQPage` con sus seis preguntas; `/contacto` lleva la organización con ciudad y país.
- 1.1 Portada retitulada: «Bachillerato virtual para adultos | ALBA Futuro Educativo», y el pie
  enlaza a los cinco pilares.
- 1.2 a 1.6 Los cinco pilares, con una sola plantilla (`features/marketing/site-page.tsx`) y el
  copy en `messages/es-CO.json` (`sitePages.*`). Una página nueva = una entrada en el registro,
  su copy y una carpeta en `app/` con seis líneas.

**Decidido al escribirlas**: el programa es 100 % virtual y sin sede de atención (mensajes de
Kris, 13/11), así que el pilar de Bogotá lo dice sin rodeos y `/contacto` no publica dirección:
solo «sede administrativa en Bogotá». Sin precio y sin duración en meses (reglas de contenido).
La tabla de ciclos usa la equivalencia del Decreto 3011 (CLEI 1 a 6).

**Falta**:

- Que Kris revise el copy de los cinco pilares antes de pedir su indexación. Dudas concretas: la
  edad mínima (16 años) frente a las edades del decreto para la media, y el trámite del
  certificado cuando el colegio cerró.
- 0.1 Volúmenes de Keyword Planner y 0.5 analítica (Vercel Web Analytics pide instalar el
  paquete y abrir su dominio en la política de contenido de `middleware.ts`).
- 0.6 Reenviar el sitemap en Search Console y pedir la indexación de cada pilar.
- La portada no puede ser estática mientras la política de contenido use `strict-dynamic` con
  nonce (`app/layout.tsx:32`): cada respuesta lleva un nonce distinto.

## Criterio de salida (a los 3 meses de fase 1)

- Las páginas del registro están indexadas (Search Console › Páginas).
- Impresiones por grupo del mapa en Search Console, con tendencia creciente.
- Al menos una búsqueda local (grupo «Local, decidir») en las primeras 10 posiciones en
  Bogotá.
- Contactos por WhatsApp atribuidos a páginas orgánicas, medidos con el paso 0.5.

## Riesgos

- **Confianza sin los datos pendientes**: en un tema YMYL, una promesa de legalidad sin
  institución nombrada pesa poco. Mitiga: citar la norma y publicar el dato apenas se pueda.
- **Competir con «gratis»** (SED): se gana explicando la diferencia (virtual, a tu ritmo,
  acompañamiento), no escondiéndola.
- **Tiempo**: un dominio nuevo tarda meses en posicionar; la fase 3 acelera, la 1 es la base.
