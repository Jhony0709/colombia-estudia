# Auditoría SEO — ALBA Futuro Educativo (11/10/2026)

Alcance: la web pública de `albafuturoeducativo.com` servida por `apps/web` (Next.js 15.5.25,
App Router, Vercel). Es una auditoría: no se ha cambiado código. Cada afirmación sobre el repo
cita `archivo:línea`; lo observado en producción se marca **[prod]** y lo inferido,
**[inferencia]**.

## Decisiones tomadas (11/10, Jhonny)

- **D1**: el `<title>` vuelve a «ALBA Futuro Educativo · Termina tu bachillerato virtual».
- **D2**: el host canónico es la raíz, sin `www`. `www` debe responder 308 hacia la raíz en
  Vercel → Domains, y `NEXT_PUBLIC_APP_URL` de Production debe ser `https://albafuturoeducativo.com`.
- **D3**: `/auth/login` y `/registro` **se indexan**. `noindex` queda en el resto de `auth/*`,
  en `certificado/*` y en `invitacion/*`. Sustituye a la recomendación de SEO-06.
- **D8**: el WhatsApp es el teléfono de soporte, `+573102502207`. Es un dato de la institución
  de producción; no hay código que cambiar.
- **D9**: pendiente (política de tratamiento de datos).

Implementado en el árbol (sin commit): SEO-01, 05, 06 (según D3), 08, 13 y 14.

## 0. Cómo se hizo y qué no se pudo ver

- **Repo**: lectura directa de `app/`, `middleware.ts`, `lib/authz/`, `features/marketing/`,
  `messages/es-CO.json`, `next.config.ts` y del código instalado de Next
  (`node_modules/next/dist/…`, versión 15.5.25).
- **Producción**: `WebFetch` sobre `/`, `/robots.txt`, `/sitemap.xml`, una URL inexistente,
  `/registro`, `/auth/login` y `staging.`. `WebFetch` devuelve el contenido, **no** los códigos
  HTTP ni las cabeceras. `curl` desde mi entorno está bloqueado por la política de salida
  (`connect_rejected`), así que los estados HTTP exactos quedan **por confirmar** con los
  comandos de §11.
- **Sin datos**: no hay acceso a Search Console, GA4, CrUX, Vercel Analytics ni a
  herramientas de palabras clave. No se da ninguna cifra de tráfico, volumen ni conversión.
- **Documentación oficial consultada**: Google Search Central (funciones de IA, nombres de
  sitio, changelog de datos estructurados) y el código de Next instalado (ver Fuentes).
- **Nota de despliegue**: producción todavía muestra la portada anterior a los cambios del
  11/10 (sección «Personas reales», la palabra «cohorte» en precios) **[prod]**. Lo que sigue
  audita el código actual del repo, y producción cuando lo dice.

---

## 1. Executive Summary

El sitio público es **una sola página** (`/`) bien construida: renderizado en servidor, HTML
semántico, imágenes y fuentes optimizadas, y accesibilidad vigilada en CI. El problema no es la
calidad de la portada, sino la infraestructura que la rodea: hoy un buscador **no puede leer
`robots.txt` ni el sitemap**, cualquier URL desconocida acaba en la pantalla de login y no
existe ninguna medición. A eso se suman dos huecos de negocio visibles en producción que
afectan a la conversión y a la confianza.

Hallazgos principales:

1. **`/robots.txt` y `/sitemap.xml` sirven la pantalla de login.** El middleware protege toda
   ruta no listada (`lib/authz/routes.ts:37,47-62`, `middleware.ts:127-134`) y no existen
   `app/robots.ts` ni `app/sitemap.ts`. **[prod]** confirmado: ambas URL muestran «Inicia
   sesión».
2. **Cualquier URL inexistente redirige al login** en lugar de dar 404 (misma causa).
   **[prod]**: `/pagina-que-no-existe-seo` muestra el login.
3. **Producción no tiene teléfono de WhatsApp.** `supportPhone` está vacío en la institución
   de producción, así que todos los CTA caen a `mailto:` (`features/marketing/contact-links.ts:24-28`).
   **[prod]**: la portada no muestra ningún teléfono y el pie solo tiene el correo. La
   estrategia de conversión (y el texto «soporte por WhatsApp las 24 horas», `es-CO.json:2580`)
   depende de ese número.
4. **Producción no tiene política de tratamiento de datos.** `dataPolicyUrl` está vacío: el pie
   oculta la columna «Legal» (`site-footer.tsx:59-65`) y el consentimiento del registro se
   acepta sin enlace a la política (`registration-content.tsx:331-340`). Es un riesgo legal
   (Ley 1581) y una señal de confianza ausente.
5. **Sin canonical, sin `metadataBase` y sin plantilla de título.** `app/layout.tsx:33-36` solo
   define `title` y `description`; `app/page.tsx:15-27` no declara `alternates.canonical` ni
   `og:url`. Hay al menos dos hosts sirviendo el mismo contenido (apex/`www` y el alias
   `colombia-estudia.vercel.app`).
6. **Ninguna página pública declara `noindex`.** El login, el registro, la verificación de
   constancias (que muestra el nombre de un estudiante) y las invitaciones con token son
   indexables si un buscador llega a ellas (`grep` de `robots:`/`noindex` en `app/` vacío).
7. **No hay datos estructurados.** No existe `Organization`/`EducationalOrganization` ni
   `WebSite` en la portada. `WebSite` es lo que Google usa para elegir el nombre del sitio.
8. **No hay medición.** Ni Search Console (sin verificar en el repo ni en la documentación),
   ni analítica web, ni eventos de conversión. Vercel Analytics y Speed Insights están en el
   plan (`plan/10-endurecer-y-lanzar.md:18`) pero no instalados (`apps/web/package.json`).
9. **El título nuevo no contiene la intención de búsqueda.** «ALBA Futuro Educativo ·
   Aprender es avanzar» (`es-CO.json:2690`) es solo marca; «bachillerato» aparece en la
   descripción pero no en el `<title>` ni en el H1. Es una **decisión pendiente** (D1), no un
   error.
10. **Señales de confianza (E-E-A-T) débiles para un tema sensible.** La portada afirma que el
    título es «legal y registrado ante el Ministerio» y que se dicta «en convenio con
    instituciones educativas autorizadas» (`es-CO.json:2586,2665`), pero no nombra a la
    institución, ni la resolución, ni la sede, ni el NIT.

**Lo que está bien y debe conservarse**: SSR con el contenido completo en el HTML; un solo H1
y H2 por sección; FAQ con `<details>` nativo; `lang="es-CO"`; `next/image` con `sizes` y
`priority` en el hero; fuentes autoalojadas; imagen OG de 1200×630 con la marca nueva;
pa11y y axe en CI; HSTS; staging detrás de la protección de Vercel.

---

## 2. Estado actual

### 2.1 Stack y rendering

| Pieza                        | Estado                                                                                                                                                                                                                       | Evidencia                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Framework                    | Next.js 15.5.25, App Router                                                                                                                                                                                                  | `node_modules/next/package.json`                                       |
| Rendering                    | Todo dinámico (`force-dynamic` en el layout raíz) por la CSP con nonce y `strict-dynamic`                                                                                                                                    | `app/layout.tsx:17-31`                                                 |
| Contenido en el HTML inicial | Sí: la portada es un Server Component; solo animaciones, menú móvil y acordeón son cliente                                                                                                                                   | `features/marketing/landing.tsx:45-87`                                 |
| Metadatos                    | API de metadatos de Next; en 15.5 se transmiten en streaming a navegadores y se bloquean en `<head>` para bots «limitados» (Bingbot, facebookexternalhit, WhatsApp, Twitterbot…). Googlebot ejecuta JS y recibe el streaming | `next/dist/shared/lib/router/utils/html-bots.js:15`, `is-bot.js:33-36` |
| Middleware                   | Request ID, sesión de Supabase en cada petición, redirección a login si la ruta es protegida, cabeceras de seguridad                                                                                                         | `middleware.ts:74-141`                                                 |
| i18n                         | `next-intl` sin rutas por idioma; un solo idioma `es-CO`                                                                                                                                                                     | `next.config.ts:4`, `app/layout.tsx:79`                                |
| Observabilidad               | Sentry; telemetría propia solo en el área del estudiante (`PrimaryActionTracker`)                                                                                                                                            | `apps/web/package.json` (`@sentry/nextjs`), `docs/estado.md:6016`      |
| Analítica web                | Ninguna                                                                                                                                                                                                                      | `apps/web/package.json`                                                |
| Hosting                      | Vercel; producción `albafuturoeducativo.com`, staging `staging.albafuturoeducativo.com` protegido (302 a `vercel.com/login`) **[prod]**                                                                                      | `docs/runbooks/dominio-y-correo.md:32`                                 |

**[inferencia]** Que WebFetch no viera `<title>` en ninguna página se explica por el streaming
de metadatos: su agente no está en `HTML_LIMITED_BOT_UA_RE`, así que el título llega al final
del body. No es un fallo para Google; hay que confirmarlo con el `curl -A bingbot` de §11.

### 2.2 Negocio y recorrido

- **Producto público**: bachillerato por ciclos para adultos, 100 % en línea, con tutor
  (`es-CO.json` → `landing.*`). Mercado: Colombia, un idioma.
- **Recorrido**: búsqueda → `/` → (a) WhatsApp/correo (fuera del sitio, sin medir) o (b)
  «Comenzar» → `/registro` (4 pasos) → cuenta. Con sesión: «Ingresar» → `/ingresar` → área
  del rol (`app/ingresar/page.tsx:17-32`).
- Fuera de alcance: la plataforma también se vende a instituciones (`docs/propuesta-de-valor.md`).
  Hoy no hay web B2B; ver D10.

### 2.3 Clasificación de páginas

| Clase                    | Rutas                                                                                                                                                                                    | Comentario                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Indexable prioritaria    | `/`                                                                                                                                                                                      | La única página con contenido para captar búsquedas                                                           |
| Indexable secundaria     | —                                                                                                                                                                                        | No existe ninguna hoy                                                                                         |
| Indexable condicional    | `/registro`, `/auth/login`                                                                                                                                                               | Solo útiles para búsquedas de marca («alba futuro educativo ingresar»). Recomendación: `noindex, follow` (D3) |
| No indexable por negocio | `/certificado/[code]`, `/invitacion/[token]`, `/auth/recuperar`, `/auth/restablecer`, `/auth/mfa`, `/auth/logout`, `/auth/callback`                                                      | Datos personales o tokens; pantallas de proceso                                                               |
| Privada                  | `/aprender/*`, `/cohortes/*`, `/contenido/*`, `/cartera/*`, `/personas/*`, `/admin/*`, `/familia/*`, `/aliado`, `/ingresar`, `/sin-acceso`, `/notificaciones`, `/solicitudes`, `/inicio` | Protegidas por el middleware (`lib/authz/routes.ts:47-62`); un bot sin sesión nunca ve su HTML                |

**Diagnóstico de preparación SEO**: el contenido está listo para indexarse, pero la capa de
rastreo (robots, sitemap, 404, canonical, `noindex`) no existe o está rota, y no hay
manera de medir nada.

---

## 3. SEO Health Score

Puntuaciones de 0 a 100 según criterio experto, ancladas a la evidencia de §4. El total se
calcula solo sobre las áreas evaluadas.

| Categoría            | Peso | Puntuación      | Por qué                                                                                                     |
| -------------------- | ---- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| Rastreo e indexación | 20   | 30              | Robots y sitemap rotos; URLs desconocidas → login; sin canonical. El contenido sí es rastreable             |
| Metadatos            | 15   | 50              | Título y descripción en `/`, OG con imagen; sin canonical, `metadataBase`, plantilla ni `noindex`           |
| Rendering            | 10   | 85              | SSR completo; streaming de metadatos compatible con Google                                                  |
| Datos estructurados  | 5    | 20              | No hay ninguno; poco que marcar, pero falta lo básico                                                       |
| Contenido y E-E-A-T  | 20   | 40              | Copy claro y orientado al usuario; una sola página, sin respaldo institucional visible ni política de datos |
| Accesibilidad y UX   | 10   | 85              | pa11y y axe en CI, `<details>` nativo, objetivos de 44 px; CTA principal degradado a `mailto:` en prod      |
| Medición             | 10   | 15              | Sin Search Console, sin analítica, sin eventos de conversión                                                |
| Rendimiento (CWV)    | 10   | **No evaluado** | Sin datos de campo ni de laboratorio                                                                        |

**Total evaluado: 46/100** (4.100 puntos ÷ 90 de peso evaluado).

---

## 4. Hallazgos de auditoría

Leyenda: ✅ confirmado (repo o prod) · ⚠️ sospecha · ❔ no disponible.

| ID     | Hallazgo                                                                 | Evidencia                                                                                                                                      | Causa                                             | Impacto                                                                                                                                                                                                | Corrección                                  |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| H1 ✅  | `/robots.txt` sirve el login                                             | `lib/authz/routes.ts:37` (no está en `PUBLIC_EXACT`); `middleware.ts:127-134`; no existe `app/robots.ts`. **[prod]** WebFetch: «Inicia sesión» | Default-deny del middleware + ausencia de robots  | Medio-alto: Google sigue la redirección y lee el HTML del login como si fuera robots.txt; sin reglas válidas, rastrea sin restricciones, pero no hay ninguna línea `Sitemap:` ni control sobre `/api/` | SEO-01                                      |
| H2 ✅  | `/sitemap.xml` sirve el login                                            | Igual que H1. **[prod]** confirmado                                                                                                            | Igual                                             | Alto: descubrimiento sin sitemap                                                                                                                                                                       | SEO-01                                      |
| H3 ✅  | URLs inexistentes redirigen a `/auth/login?next=…` en vez de dar 404     | `lib/authz/routes.ts:60-62`; **[prod]** `/pagina-que-no-existe-seo` → login                                                                    | Default-deny                                      | Medio: el login acumula variantes `?next=` y no hay 404 reales para URLs rotas                                                                                                                         | SEO-02 (decisión de seguridad, ver Anexo A) |
| H4 ✅  | WhatsApp ausente en producción                                           | `contact-links.ts:24-28` cae a `mailto:` sin teléfono; `site-footer.tsx:47-51`. **[prod]** sin teléfonos en la portada                         | `supportPhone` no se cargó en el SQL de la Fase C | Alto en conversión: el canal principal no existe                                                                                                                                                       | SEO-03                                      |
| H5 ✅  | Sin política de datos en producción                                      | `site-footer.tsx:59-65`; `registration-content.tsx:331-340`; **[prod]** pie sin «Legal»                                                        | `dataPolicyUrl` vacío                             | Alto (legal y confianza)                                                                                                                                                                               | SEO-03                                      |
| H6 ✅  | Sin `metadataBase`, canonical ni `og:url`                                | `app/layout.tsx:33-36`; `app/page.tsx:15-27`                                                                                                   | No se configuró                                   | Medio: duplicados por host sin consolidar; la URL de la imagen OG depende de `VERCEL_PROJECT_PRODUCTION_URL` (`next/dist/lib/metadata/resolvers/resolve-url.js:55`)                                    | SEO-05                                      |
| H7 ⚠️  | Host canónico ambiguo                                                    | El runbook dice que `www` redirige a la raíz (`dominio-y-correo.md:32`); **[prod]** WebFetch de la raíz devolvió enlaces absolutos en `www.`   | Configuración de dominios en Vercel               | Medio                                                                                                                                                                                                  | SEO-04 (confirmar con §11)                  |
| H8 ⚠️  | Alias `colombia-estudia.vercel.app` sirve producción                     | Resumen de la configuración de entornos; WebFetch falló al leerlo                                                                              | Alias heredado de cuando era staging              | Bajo-medio: duplicado de host                                                                                                                                                                          | SEO-04                                      |
| H9 ✅  | Ninguna página pública con `noindex`                                     | `grep` sin resultados de `robots:`/`noindex` en `app/`; **[prod]** login y registro sin meta robots                                            | No se configuró                                   | Medio: `/certificado/[code]` muestra nombres de estudiantes; tokens en `/invitacion/[token]`                                                                                                           | SEO-06                                      |
| H10 ✅ | Sin plantilla de título; títulos sin marca                               | `app/layout.tsx:34` (cadena fija); `registro/page.tsx:15` («Regístrate»); las páginas de `auth/*` no declaran título                           | No se configuró                                   | Bajo: SERP y pestañas sin marca                                                                                                                                                                        | SEO-05                                      |
| H11 ✅ | Sin datos estructurados                                                  | `grep` de `ld+json` sin resultados                                                                                                             | —                                                 | Medio para el nombre del sitio y la entidad; nulo para rich results                                                                                                                                    | SEO-08                                      |
| H12 ✅ | Título sin intención de búsqueda                                         | `es-CO.json:2690`; H1 `hero.tsx:31-34` («Tu historia también puede continuar»)                                                                 | Decisión de marca del 11/10                       | Medio en búsquedas sin marca **[inferencia, sin datos]**                                                                                                                                               | D1 / SEO-07                                 |
| H13 ✅ | Afirmaciones legales sin respaldo visible                                | `es-CO.json:2586,2665`                                                                                                                         | Falta el contenido                                | Alto en confianza para un tema de educación y dinero                                                                                                                                                   | SEO-10                                      |
| H14 ✅ | Sin analítica ni Search Console                                          | `apps/web/package.json`; `plan/10-endurecer-y-lanzar.md:18` (planeado)                                                                         | Pendiente del plan                                | Alto: no se puede medir ni priorizar                                                                                                                                                                   | SEO-09                                      |
| H15 ✅ | La 404 manda al anónimo al login                                         | `app/not-found.tsx:18` (`/ingresar`, protegida)                                                                                                | —                                                 | Bajo (UX)                                                                                                                                                                                              | SEO-13                                      |
| H16 ⚠️ | El LCP podría retrasarse por la entrada animada del hero                 | `site.css:688` (H1 con 160 ms de retraso desde opacidad 0), `site.css:700,732` (foto desde 260 ms)                                             | Diseño de movimiento                              | Desconocido: medir antes de tocar                                                                                                                                                                      | SEO-11                                      |
| H17 ⚠️ | Atkinson se precarga también en la portada, que usa Lexend               | `app/fonts/sans.ts:28-29` en el layout raíz; `app/fonts/site.ts`                                                                               | Fuente global                                     | Bajo                                                                                                                                                                                                   | SEO-12                                      |
| H18 ✅ | Terminología mezclada: «proceso de validación» en un programa por ciclos | `es-CO.json:2580` frente a `:2665`                                                                                                             | Herencia de Valida YA                             | Medio: «validar el bachillerato» suele referirse al examen del ICFES **[inferencia]**                                                                                                                  | SEO-07                                      |
| H19 ❔ | Core Web Vitals, cobertura de índice, consultas reales                   | —                                                                                                                                              | Sin herramientas                                  | —                                                                                                                                                                                                      | SEO-09                                      |

**Conservar**: `hero.tsx:53-59` (`priority` y `sizes` en la imagen LCP); `faq.tsx:10-15`
(`<details>` nativo); `app/opengraph-image.png` (1200×630, marca ALBA); `middleware.ts:58-70`
(HSTS y demás cabeceras); `next.config.ts:23-41` (301 de URLs antiguas, todas privadas).

---

## 5. Oportunidades estratégicas

1. **Que Google pueda rastrear e indexar la portada sin ruido** (SEO-01, 02, 05, 06). Es la
   condición previa de todo lo demás.
2. **Convertir lo que ya llega** (SEO-03): con WhatsApp activo y medido, cada visita
   orgánica tiene un camino de una pulsación.
3. **Entidad clara** (SEO-08, 10): nombre del sitio, organización, institución en convenio,
   política de datos. Sirve igual a Google, a Bing/Copilot y a quien decide matricularse.
4. **Intención de búsqueda** (SEO-07): que «bachillerato virtual para adultos» o
   «bachillerato por ciclos» aparezca donde Google lo lee (título, H1 o entradilla), sin
   perder el lema.
5. **Contenido nuevo solo con datos** (SEO-15): cuando Search Console muestre consultas
   reales, una o dos páginas que respondan dudas frecuentes. Candidata **[hipótesis]**:
   «Validar con el ICFES o hacer el bachillerato por ciclos: diferencias». En los resultados
   observados (búsqueda desde EE. UU., solo indicativa) compiten cajas de compensación
   (Colsubsidio), directorios (Emagister), medios que explican la validación del ICFES y
   colegios virtuales.

### 5.1 Búsqueda con IA (AI Overviews, AI Mode, Bing/Copilot)

**Documentado por Google**: para aparecer en AI Overviews y AI Mode una página solo tiene que
estar indexada y ser apta para mostrar fragmento; no hay requisitos extra, ni archivos
especiales, ni schema específico. El tráfico se cuenta dentro de «Web» en el informe de
Rendimiento de Search Console. Los controles son los de siempre (`noindex`, `nosnippet`,
`max-snippet`, robots.txt) y `Google-Extended`, que no afecta a Search.

**Buenas prácticas aceptadas, que aquí ya cubre el backlog**: rastreo e indexación sanos
(SEO-01, 05, 06); una entidad clara y coherente (SEO-08, 10); respuestas directas y
verificables en la FAQ, que ya existe en HTML nativo (`faq.tsx:46-58`); el mismo nombre,
correo y teléfono en la web y en los perfiles (SEO-16); indexación en Bing (SEO-09 b).

**Hipótesis por validar**: que nombrar la institución en convenio y la norma vigente aumente
las citas en respuestas generativas a preguntas como «¿es válido el bachillerato virtual
por ciclos?». Se mide preguntando periódicamente en Google AI Mode, Copilot y ChatGPT con un
conjunto fijo de 10 preguntas, y anotando si ALBA aparece y con qué URL. Es un registro
manual y no tiene valor estadístico.

**Descartado**: `llms.txt`, contenido escrito solo para modelos y cualquier trato distinto a
los crawlers. No hay evidencia oficial de que aporten visibilidad.

### 5.2 SEO internacional

No aplica: un mercado (Colombia), un idioma (`lang="es-CO"`, `app/layout.tsx:79`;
`og:locale` `es_CO`, `app/page.tsx:24`) y ninguna redirección por ubicación. No se proponen
`hreflang` ni rutas por idioma.

---

## 6. Propuesta de arquitectura SEO

No hace falta una capa nueva. Basta con las convenciones nativas de Next 15:

- `app/robots.ts` y `app/sitemap.ts` (archivos de metadatos de Next), públicos en
  `lib/authz/routes.ts`.
- Metadatos centralizados en el layout raíz: `metadataBase` desde `NEXT_PUBLIC_APP_URL` (ya
  existe por entorno), plantilla de título y `openGraph.siteName`. Cada página solo declara lo
  propio.
- `noindex` por grupo de rutas: `app/(public)/layout.tsx` cubre de una vez `auth/*`,
  `registro`, `certificado/*` e `invitacion/*`.
- JSON-LD en un componente de servidor dentro de `features/marketing/`, con el nonce de la
  CSP como cualquier otro script.

**No se propone**: cambiar el rendering (el `force-dynamic` está justificado en
`app/layout.tsx:17-31`), rutas por idioma, `llms.txt`, ni `FAQPage` (ver Anexo A).

---

## 7. Backlog técnico priorizado

Esfuerzo: S (< ½ día) · M (1–2 días) · L (3–5 días) · XL (> 1 semana).

### P0 — Críticos

**SEO-01 · robots.txt y sitemap públicos**

- Problema/evidencia: H1, H2.
- Archivos: nuevos `app/robots.ts` y `app/sitemap.ts`; `lib/authz/routes.ts:37`;
  `__tests__/unit/authz/routes.test.ts`.
- Solución: añadir `'/robots.txt'` y `'/sitemap.xml'` a `PUBLIC_EXACT`; robots que permita
  todo salvo `/api/` en producción y lo bloquee todo fuera de ella; sitemap con `/`. No
  bloquear `/auth/*` en robots: si se bloquea, Google no ve el `noindex` de SEO-06.
- Responsable: Frontend. Dependencias: D2 (host canónico) para la URL absoluta.
- Esfuerzo S · Impacto alto · Confianza alta.
- Riesgo: que el robots de producción salga como el de staging. Mitigación: test.
- Aceptación: `curl -sI https://<host>/robots.txt` → `200` y `text/plain`; el sitemap →
  `200` y `application/xml`; Search Console lee el sitemap sin errores.
- KPI: sitemap «Correcto» en GSC; páginas indexadas = 1 (`/`).

**SEO-03 · Teléfono de WhatsApp y política de datos en producción**

- Problema/evidencia: H4, H5.
- Archivos: ninguno (dato). Panel de administración de la institución
  (`app/(admin)/admin/institucion/page.tsx`) o SQL en el editor de Supabase de producción.
- Solución: cargar `supportPhone` (con indicativo 57) y `dataPolicyUrl`. Si la política no
  está publicada aún, publicarla (D9).
- Responsable: Jhonny / negocio. Dependencias: D8, D9.
- Esfuerzo S · Impacto alto · Confianza alta.
- Aceptación: la portada muestra el botón flotante y los CTA abren `wa.me/57…?text=…`; el pie
  muestra «Legal»; el paso de consentimiento del registro enlaza la política.
- KPI: clics en WhatsApp (tras SEO-09).

### P1 — Alto impacto

**SEO-02 · 404 reales frente a default-deny**

- Problema/evidencia: H3. Decisión en el Anexo A (conflicto 1).
- Solución acordada: **no** invertir la protección. `noindex` en el login (SEO-06) y canonical
  del login a `/auth/login` sin `?next=`. Revisar cuando haya más páginas públicas.
- Esfuerzo S · Impacto medio · Confianza media.

**SEO-04 · Un solo host canónico**

- Problema/evidencia: H7, H8.
- Solución: confirmar con §11 qué host responde 200; dejar el otro con 308 en Vercel →
  Domains; quitar o redirigir el alias `colombia-estudia.vercel.app`; que
  `NEXT_PUBLIC_APP_URL` de Production sea exactamente ese host; corregir el runbook
  (`dominio-y-correo.md:32`) si no coincide.
- Responsable: Jhonny (Vercel). Esfuerzo S · Impacto medio · Confianza alta.
- Aceptación: el host no canónico responde 308 hacia el canónico, en una sola redirección.

**SEO-05 · Metadatos base: `metadataBase`, plantilla, canonical, `siteName`**

- Problema/evidencia: H6, H10.
- Archivos: `app/layout.tsx:33-36`, `app/page.tsx:15-27`.
- Esfuerzo S · Impacto medio · Confianza alta.
- Regresión: con plantilla, la portada necesita `title.absolute` o saldría con la marca
  repetida; las pantallas privadas pasan a llevar «· ALBA Futuro Educativo» (deseable).
- Aceptación: `<link rel="canonical" href="https://<host>/">`, `og:url` y `og:site_name` en
  `/`; títulos de `auth/*` y `registro` con la marca.

**SEO-06 · `noindex` donde no aporta**

- Problema/evidencia: H9.
- Archivo: `app/(public)/layout.tsx:9-11` (exportar `metadata.robots`).
- Esfuerzo S · Impacto medio · Confianza alta. Dependencia: D3.
- Aceptación: `<meta name="robots" content="noindex, follow">` en login, registro,
  certificado e invitación; ausente en `/`.

**SEO-08 · `EducationalOrganization` + `WebSite` en la portada**

- Problema/evidencia: H11. Google usa `WebSite` (`name`, `url`, `alternateName`) en la
  portada para el nombre del sitio; `Organization` para el logo y los datos de la entidad.
- Archivos: nuevo `features/marketing/structured-data.tsx`; `features/marketing/landing.tsx`.
- Datos: solo lo visible y verificable (nombre, URL, logo `public/brand/alba-logo-horizontal.png`
  de 1229×400, correo, teléfono si existe). `sameAs` vacío hasta que haya perfiles reales.
- Esfuerzo S · Impacto medio · Confianza media (el nombre del sitio no está garantizado).
- Aceptación: la prueba de resultados enriquecidos y el validador de schema.org lo leen sin
  errores; el JSON-LD lleva nonce y no lo bloquea la CSP.

**SEO-09 · Medición mínima**

- Problema/evidencia: H14, H19.
- Solución: (a) Search Console con propiedad de dominio (TXT en Cloudflare) y envío del
  sitemap; (b) Bing Webmaster Tools importando desde GSC (Copilot se apoya en el índice de
  Bing); (c) `@vercel/analytics` y `@vercel/speed-insights`, ya previstos en
  `plan/10-endurecer-y-lanzar.md:18`, sin cookies y servidos desde el mismo origen (la CSP
  `'self'` + `strict-dynamic` debería bastar **[por verificar en staging]**); (d) eventos:
  clic en WhatsApp, clic en «Comenzar», registro completado.
- Responsable: Analytics + Frontend. Esfuerzo M · Impacto alto · Confianza alta.
- Dependencia: D4 (eventos personalizados según el plan de Vercel).
- Aceptación: GSC verificado; Speed Insights con datos de `/`; los tres eventos aparecen.

**SEO-10 · Respaldo institucional visible**

- Problema/evidencia: H13, H5.
- Solución de contenido: nombrar la(s) institución(es) en convenio, la resolución de
  aprobación y la entidad que expide el título, con el dato legal revisado (D5). Un bloque
  breve en la FAQ «¿El título es válido?» y en el pie basta; no hace falta una página nueva.
- Responsable: Contenido + legal. Esfuerzo S–M · Impacto alto · Confianza media.
- Aceptación: cada afirmación de `es-CO.json:2586,2665` tiene detrás un nombre comprobable.

### P2 — Estructural

**SEO-07 · Intención en título, H1 y terminología** (D1). Opciones en D1 (§11). Además,
sustituir «proceso de validación» (`es-CO.json:2580`) por «proceso» o «bachillerato por
ciclos» si el programa no es la validación del ICFES. Esfuerzo S · Impacto medio · Confianza
baja hasta tener datos de GSC.

**SEO-11 · LCP del hero**: medir primero (Speed Insights p75 en móvil). Si el elemento LCP es
el H1 o la foto y el p75 supera 2,5 s, quitar la opacidad inicial de ese elemento y dejar solo
el desplazamiento. Esfuerzo S · Impacto desconocido · Confianza baja.

**SEO-12 · Precarga de Atkinson en la portada**: comprobar en el HTML si se precarga; si es
así, `preload: false` en `app/fonts/sans.ts` o cargarla solo en los layouts de la app.
Esfuerzo S · Impacto bajo.

**SEO-13 · La 404 del anónimo**: `app/not-found.tsx:18` → `/` si no hay sesión. Esfuerzo S ·
Impacto bajo (UX).

**SEO-14 · Pruebas SEO en CI**: un spec de Playwright (detalle en el Anexo B).
Esfuerzo S–M · Impacto alto como red de seguridad.

### P3 — Crecimiento y experimentación

**SEO-15 · Contenido guiado por datos**: tras 6–8 semanas de GSC, una página por cada grupo de
consultas no-marca con impresiones y sin respuesta en `/`. Nada antes.

**SEO-16 · Presencia de marca**: perfiles reales (WhatsApp Business, Facebook, Instagram)
enlazados en el pie y en `sameAs`; Google Business Profile solo si hay sede física que
atienda público (D7).

**SEO-17 · Búsqueda con IA**: medir y decidir según §5.1; no requiere código propio.

---

## 8. Roadmap 30/60/90 días

| Ventana    | Entregables                                                                          | Responsable             | Dependencias         | Criterio de éxito                                                                               |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| Días 1–7   | SEO-03 (dato), SEO-04 (Vercel), D1–D3 decididas                                      | Jhonny                  | —                    | WhatsApp y política visibles en prod; un host                                                   |
| Días 1–30  | SEO-01, 05, 06, 08, 13, 14; GSC y Bing (SEO-09 a, b)                                 | Frontend                | D2, D3               | robots y sitemap válidos en GSC; canonical y `noindex` en su sitio; CI en verde con el spec SEO |
| Días 30–60 | SEO-09 c, d (analítica y eventos); SEO-10 (respaldo legal); SEO-07 según D1          | Frontend + Contenido    | D4, D5               | Eventos de conversión registrados; afirmaciones legales con nombre                              |
| Días 60–90 | SEO-11/12 si los datos lo piden; primera lectura de consultas en GSC; decidir SEO-15 | Performance + Contenido | 4–8 semanas de datos | Informe de consultas marca/no marca; CWV p75 de `/` conocidos                                   |

Las métricas de posicionamiento (impresiones, posición, CTR) necesitan semanas; los
resultados técnicos (robots, canonical, `noindex`) se verifican el mismo día del despliegue.

---

## 9. Quick Wins

Todos son de esfuerzo S, sin dependencias nuevas, y se verifican el mismo día:

| Cambio                                                            | Archivo / lugar                                             | Por qué tiene impacto                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Cargar `supportPhone` y `dataPolicyUrl` (SEO-03)                  | Institución de producción                                   | Activa el canal principal de conversión y el enlace legal del registro (H4, H5) |
| Hacer públicos `/robots.txt` y `/sitemap.xml` y crearlos (SEO-01) | `lib/authz/routes.ts:37`, `app/robots.ts`, `app/sitemap.ts` | Hoy sirven el login (H1, H2)                                                    |
| `noindex, follow` en el grupo `(public)` (SEO-06)                 | `app/(public)/layout.tsx`                                   | Una línea saca del índice login, registro, constancias e invitaciones (H9)      |
| `metadataBase`, plantilla y canonical (SEO-05)                    | `app/layout.tsx:33-36`, `app/page.tsx:15-27`                | Consolida hosts y pone la marca en todos los títulos (H6, H10)                  |
| Un solo host con 308 (SEO-04)                                     | Vercel → Domains                                            | Elimina duplicados (H7, H8)                                                     |
| Verificar Search Console y Bing                                   | Cloudflare (TXT)                                            | Sin esto no hay ningún dato para decidir (H14)                                  |
| 404 → `/` para el anónimo (SEO-13)                                | `app/not-found.tsx:18`                                      | Quien llega a un enlace roto no acaba en el login (H15)                         |

## 10. KPIs y observabilidad

| Tipo              | KPI                                                                                   | Fuente                                                        | Cuándo se ve          |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------- |
| Técnico inmediato | robots/sitemap 200, canonical, `noindex` correctos                                    | spec SEO-14 en CI; `curl` tras desplegar                      | El día del despliegue |
| Indexación        | Páginas indexadas (esperado: 1) y excluidas por `noindex`                             | GSC → Páginas                                                 | 1–4 semanas           |
| Visibilidad       | Impresiones, clics, CTR y posición de `/`, separando marca (regex `alba`) de no marca | GSC → Rendimiento (incluye AI Overviews y AI Mode bajo «Web») | 4–12 semanas          |
| Bing/Copilot      | Indexación y clics                                                                    | Bing Webmaster Tools                                          | 4–12 semanas          |
| Conversión        | Clics en WhatsApp, clics en «Comenzar», registros completados                         | Vercel Analytics (eventos) + base de datos                    | Desde la instalación  |
| Experiencia       | LCP, INP y CLS p75 de `/` en móvil (umbrales 2,5 s / 200 ms / 0,1)                    | Speed Insights (campo); CrUX solo si hay tráfico suficiente   | 2–4 semanas de datos  |
| Calidad continua  | pa11y + axe                                                                           | CI actual                                                     | Cada push             |

Revisión: mensual en GSC, y tras cada despliegue que toque `app/layout.tsx`, `app/page.tsx`,
`middleware.ts` o `lib/authz/routes.ts`.

---

## 11. Riesgos y decisiones pendientes

| ID  | Decisión                                           | Opciones                                                                                                                                                  | Recomendación                                                       |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| D1  | `<title>` de la portada                            | (a) solo marca (actual); (b) «Bachillerato virtual para adultos · ALBA Futuro Educativo»; (c) «ALBA Futuro Educativo · Bachillerato virtual para adultos» | (b), con el lema en `og:title`                                      |
| D2  | Host canónico                                      | apex o `www`                                                                                                                                              | El que hoy responde 200; alinear `NEXT_PUBLIC_APP_URL` y el runbook |
| D3  | ¿Indexar `/registro` y `/auth/login`?              | Sí / `noindex, follow`                                                                                                                                    | `noindex, follow`                                                   |
| D4  | Eventos de conversión                              | Vercel Analytics (eventos según el plan contratado) / GA4                                                                                                 | Vercel Analytics                                                    |
| D5  | Nombrar la institución en convenio y la resolución | —                                                                                                                                                         | Sí, con revisión legal de `es-CO.json:2586,2665`                    |
| D6  | `Google-Extended`                                  | Permitir / bloquear                                                                                                                                       | Permitir (no afecta a Search); decisión de negocio                  |
| D7  | Google Business Profile                            | Solo con sede que atienda público                                                                                                                         | Esperar                                                             |
| D8  | Número de WhatsApp de producción                   | —                                                                                                                                                         | Bloquea SEO-03                                                      |
| D9  | Política de tratamiento de datos                   | Página propia en la web / documento externo                                                                                                               | Página pública propia, enlazada desde el pie y el registro          |
| D10 | Web B2B para instituciones                         | —                                                                                                                                                         | Fuera de esta auditoría                                             |

**Riesgos**: que el robots de producción salga en modo «bloquear todo» (mitigado por SEO-14);
que la plantilla de título duplique la marca en `/` (mitigado con `title.absolute`); que la CSP
bloquee la analítica (probar en staging).

### Comprobaciones que no pude hacer (ejecútalas tú)

```sh
curl -sI https://albafuturoeducativo.com/
curl -sI https://www.albafuturoeducativo.com/
curl -sI https://albafuturoeducativo.com/robots.txt
curl -sI https://albafuturoeducativo.com/pagina-que-no-existe
curl -sI https://colombia-estudia.vercel.app/
curl -s -A "Mozilla/5.0 (compatible; bingbot/2.0)" https://albafuturoeducativo.com/ | grep -o "<title>[^<]*</title>"
```

---

## 12. Plan de ejecución recomendado

1. **Datos de producción** (SEO-03) y **dominios** (SEO-04). Validación: la portada en prod
   muestra WhatsApp y «Legal»; los `curl -sI` de arriba dan un solo 200 y un 308.
2. **Decisiones D1–D3.**
3. **Un PR técnico** con SEO-01, 05, 06, 08, 13 y el spec SEO-14. Validación local:
   `pnpm --filter web test:e2e` con el spec nuevo; en staging, el `curl -A bingbot` y la
   prueba de resultados enriquecidos.
4. **Producción**: desplegar; Search Console (propiedad de dominio) → enviar
   `sitemap.xml` → inspeccionar `/` y solicitar indexación; importar en Bing Webmaster Tools.
5. **Analítica** (SEO-09 c, d) en un PR aparte, probada en staging por la CSP.
6. **Contenido** (SEO-10, SEO-07) con revisión legal.
7. **A las 4–8 semanas**: lectura de GSC y Speed Insights; decidir SEO-11, 12 y 15.

---

## Anexo A. Debate del comité (solo conflictos reales)

**Conflicto 1 — 404 reales frente a default-deny (H3).**

- Technical SEO: las URL rotas deberían dar 404.
- Arquitectura/Seguridad: el middleware protege todo lo no listado (`lib/authz/routes.ts:60-62`);
  pasar a una lista de rutas protegidas abre la puerta a olvidar una ruta privada.
- Alternativas: (a) invertir la lógica; (b) mantenerla y que el login sea `noindex` con
  canonical limpio; (c) que el middleware consulte el manifiesto de rutas (frágil en Edge).
- **Decisión**: (b). Mientras la única página indexable sea `/`, el coste SEO es bajo y el
  riesgo de seguridad de (a) no compensa.

**Conflicto 2 — Lema frente a intención en el `<title>` (H12).**

- Marca: «Aprender es avanzar» es el lema y se pidió así el 11/10.
- SEO: el `<title>` es la señal más fuerte que controlamos en una web de una página; ni el
  título ni el H1 dicen «bachillerato».
- **Decisión pendiente (D1)**. Recomendación del comité: «Bachillerato virtual para adultos ·
  ALBA Futuro Educativo» en `<title>`, con el lema en `og:title` y en el pie. Medir CTR en
  GSC durante 4 semanas antes y después.

**Conflicto 3 — `FAQPage` «para la IA».**

- AI Search: marcar la FAQ podría ayudar a los sistemas generativos.
- Technical SEO: Google dejó de mostrar el resultado enriquecido de FAQ el 7/5/2026 y dice
  que las funciones de IA no requieren schema especial.
- **Decisión**: no añadirlo ahora. Cuesta poco, pero no hay beneficio documentado.

**Conflicto 4 — Animación del hero frente a LCP (H16).**

- UX/Marca: la entrada escalonada es parte del manual (5/10).
- Performance: un elemento que empieza en opacidad 0 no cuenta para el LCP hasta que se ve.
- **Decisión**: medir con datos de campo (SEO-09) antes de tocar nada.

**Conflicto 5 — GA4 frente a Vercel Analytics.**

- GA4: más profundidad y conexión con Google Ads; usa cookies (aviso y consentimiento), y la
  CSP actual tendría que abrir dominios de Google.
- Vercel Analytics: sin cookies, mismo origen, ya previsto en el plan.
- **Decisión**: Vercel Analytics ahora; GA4 solo si se lanza publicidad pagada.

---

## Anexo B. Plan de implementación en código (P0–P1)

### SEO-01 — `lib/authz/routes.ts:37`

Hoy: `const PUBLIC_EXACT = ['/', '/api/health'] as const;`

```ts
const PUBLIC_EXACT = ['/', '/api/health', '/robots.txt', '/sitemap.xml'] as const;
```

`app/robots.ts` (nuevo):

```ts
import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3030';

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
```

`app/sitemap.ts` (nuevo; sin `lastModified` inventado):

```ts
import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3030';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${BASE}/` }];
}
```

- **Por verificar**: el valor de `VERCEL_ENV` en el entorno personalizado `staging` (podría ser
  `preview`). Staging ya está protegido por Vercel, así que el riesgo es bajo.
- Pruebas: ampliar `__tests__/unit/authz/routes.test.ts` (las dos rutas no son protegidas;
  `/robots.txt.bak` sí).
- Rollback: revertir el commit; nada persiste.

### SEO-05 — `app/layout.tsx:33-36` y `app/page.tsx:15-27`

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3030'),
  title: { default: 'ALBA Futuro Educativo', template: '%s · ALBA Futuro Educativo' },
  description: 'Termina tu bachillerato a tu ritmo, 100 % en línea y con acompañamiento.',
  openGraph: { siteName: 'ALBA Futuro Educativo', locale: 'es_CO', type: 'website' },
};
```

En `app/page.tsx`:

```ts
return {
  title: { absolute: t('meta.title') },
  description: t('meta.description'),
  alternates: { canonical: '/' },
  openGraph: { title: t('meta.title'), description: t('meta.description'), url: '/' },
};
```

- Regresión: `openGraph` de la página **reemplaza** al del layout (Next no fusiona en
  profundidad), así que `siteName`, `locale` y `type` deben repetirse en la página o quedar
  solo en ella.
- Pruebas: spec de SEO-14.

### SEO-06 — `app/(public)/layout.tsx`

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: true } };
```

Y en `app/(public)/auth/login/page.tsx`: `alternates: { canonical: '/auth/login' }`.

### SEO-08 — `features/marketing/structured-data.tsx` (nuevo)

```tsx
import { headers } from 'next/headers';

export async function StructuredData({
  base,
  name,
  email,
  phone,
}: {
  base: string;
  name: string;
  email: string;
  phone: string | null;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${base}/#organizacion`,
        name,
        url: `${base}/`,
        logo: `${base}/brand/alba-logo-horizontal.png`,
        email,
        ...(phone ? { telephone: phone } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#sitio`,
        name,
        url: `${base}/`,
        inLanguage: 'es-CO',
        publisher: { '@id': `${base}/#organizacion` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
```

Se monta en `landing.tsx` con los datos de `institution`, que ya llegan a la portada
(`app/page.tsx:32`). No marcar cursos, precios ni reseñas: no hay contenido visible que los
respalde y el resultado enriquecido de Course Info ya no se muestra (se retiró el 9/9/2025).

### SEO-14 — `apps/web/__tests__/e2e/seo.spec.ts` (nuevo)

Comprobaciones (con la base de CI de `ci.yml`):

- `GET /robots.txt` → 200, `content-type` empieza por `text/plain`, contiene `Sitemap:` solo
  si `VERCEL_ENV=production` (en CI: `Disallow: /`).
- `GET /sitemap.xml` → 200 y XML válido con `/`.
- `/`: un solo `<h1>`, `link[rel=canonical]`, `meta[name=description]`, `og:image`, JSON-LD
  que parsea y tiene `WebSite.name`.
- `/auth/login`, `/registro`: `meta[name=robots]` con `noindex`.
- `GET /ruta-inexistente` → redirección al login (documenta la decisión del conflicto 1).

Para leer la etiqueta en `<head>` sin depender del streaming, la petición del spec debe usar
un user agent de bot limitado (por ejemplo `Bingbot`), igual que §11.

---

## Fuentes

- Google Search Central — [Funciones de IA y tu sitio web](https://developers.google.com/search/docs/appearance/ai-features)
- Google Search Central — [Nombres de sitio](https://developers.google.com/search/docs/appearance/site-names)
- Google Search Central — [FAQ (retirado de los resultados el 7/5/2026)](https://developers.google.com/search/docs/appearance/structured-data/faqpage)
- Google Search Central — [Changelog: Course Info y otros tipos retirados el 9/9/2025](https://developers.google.com/search/docs/appearance/structured-data/course-info)
- Google Search Central — [Simplificando la página de resultados (12/6/2025)](https://developers.google.com/search/blog/2025/06/simplifying-search-results)
- Next.js 15.5.25 instalado: `next/dist/shared/lib/router/utils/html-bots.js:15`,
  `next/dist/shared/lib/router/utils/is-bot.js:33-36`,
  `next/dist/lib/metadata/resolvers/resolve-url.js:50-56`
- Resultados indicativos (búsqueda desde EE. UU.): [Colsubsidio](https://www.colsubsidio.com/hubfs/documentos/colsubsidio/brochure-bachillerato-por-ciclos.pdf),
  [Emagister](https://www.emagister.com.co/bachillerato-para-jovenes-adultos-cursos-2818467.htm),
  [Calendario de Colombia (validación ICFES)](https://www.calendariodecolombia.com/educacion/como-validar-el-bachillerato-en-colombia-y-requisitos-para-presentar-el-examen-de-validacion-ante-el-icfes)
