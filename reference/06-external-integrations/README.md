# 06 — Integraciones externas

| Servicio                                  | Para qué                                                                                                                                            | Estado MVP                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Supabase Auth                             | Identidad. Invitación por email; recuperación de contraseña; sin auto-registro                                                                      | MVP                                                               |
| Supabase Storage                          | Imágenes, PDFs, audio, transcripciones. Buckets privados, URLs firmadas. Confirmación por `POST /api/media/[id]/confirm` (no hay webhooks firmados) | MVP                                                               |
| **Vimeo**                                 | **Todo el video.** Los 130 temas con video ya están ahí; se conservan los ids                                                                       | MVP                                                               |
| OCR (Tesseract o modelo de visión)        | Pipeline de migración: imagen de página → Markdown borrador                                                                                         | MVP (herramienta, no runtime)                                     |
| Resend                                    | Invitaciones, recuperación, recordatorios, avisos. Remitente por institución sobre un dominio verificado                                            | MVP (Free)                                                        |
| Sentry                                    | Errores, desde el primer handler                                                                                                                    | MVP (Free)                                                        |
| Vercel Cron                               | El job diario                                                                                                                                       | MVP                                                               |
| **Wompi**                                 | Pago en línea de cuotas (tarjeta, PSE, Nequi): checkout por redirección + webhook firmado + consulta de estado. 2,65 % + $700 + IVA por transacción | MVP (paridad con la propuesta competidora)                        |
| **WhatsApp Cloud API** (5/11)             | Otra oportunidad en un examen: webhook firmado que enlaza la solicitud con el chat y aviso al estudiante cuando operación la concede                | Sin variables, solo el aviso de la plataforma y el enlace `wa.me` |
| Zoom / Meet                               | Solo el enlace de la sesión en vivo; sin API                                                                                                        | MVP                                                               |
| Proveedor de facturación electrónica DIAN | La factura legal; guardamos `externalInvoiceRef`                                                                                                    | Fase 2 — cotizar                                                  |
| Mux                                       | Video adaptativo propio                                                                                                                             | **No**. Vimeo ya lo da                                            |

## Video: Vimeo como proveedor, abstracción intacta

`MediaAsset.provider` admite `VIMEO | STORAGE | YOUTUBE | MUX`. El player recibe un
`MediaAsset` y decide cómo reproducirlo; el resto del sistema no sabe de proveedores.

**Pendiente antes de la salida a producción** (decisión 11: después): verificar que el plan
de Vimeo permita **restringir el embed por dominio** y añadir el dominio propio de cada
institución. Sin eso, cualquiera que conozca el id reproduce el video.

`POST /api/media/vimeo` registra un video por id, consulta la API de Vimeo (duración,
pistas de subtítulos) y marca `captionsSource = AUTO` si las pistas son generadas. Solo un
autor que las revisó las marca `REVIEWED`; hasta entonces un video **nuevo** no publica sin
`transcriptPath`. ~~Los 130 videos migrados publican bajo la excepción de legado~~ (RETIRADO 18/9: no hay
videos migrados; la regla estricta aplica a todos).

Contrato del player (ver `03-ui/accesibilidad.md`): `title` en el iframe, "Saltar el
video", transcripción visible, "Ver solo la transcripción" sin cargar el iframe.

## OCR: pipeline de migración

Script fuera del runtime (`scripts/migrate/ocr-to-markdown.ts`):

```
imagen / PDF ─▶ OCR ─▶ Markdown crudo ─▶ normalización (títulos, listas, tablas, LaTeX) ─▶ LessonVersion DRAFT
                                     └─▶ figuras recortadas ─▶ MediaAsset IMAGE (alt pendiente)
```

El resultado siempre es un `DRAFT` que una persona revisa en el editor. Nada de OCR se
publica solo. Se prueba primero con 10 temas y se decide si el resto va por camino 1 o 2.

## Importador de LearnDash

Con la decisión 1 (solo cohortes nuevas) el importador migra **contenido, no personas ni
progreso**. Fuente: **dump SQL de la BD de WordPress + WXR** (las preguntas viven en
`wp_wp_pro_quiz_*`, no en el WXR). Idempotente por `sourceRef`; deduplica el clon "ValoraT"
por hash del JSON de preguntas y por título de tema; `dryRun` primero con
`ImportRun.summary` (conteos esperados: 110 temas, 7 evaluaciones, 239 preguntas). Las
cohortes históricas no se migran: LearnDash queda en solo lectura para ellas.

## Wompi

Checkout por redirección (widget web checkout) con `reference` = id de la cuota + intento;
eventos `transaction.updated` al webhook, verificados con `WOMPI_EVENTS_SECRET`; el
`Payment` se confirma una sola vez por `gatewayRef`. El job diario consulta las
transacciones `PENDING` de más de 1 h. Sandbox en staging con las llaves de prueba.

## WhatsApp: Cloud API de Meta (5/11)

Para la otra oportunidad en un examen (`PRODUCT_DECISIONS.md`, 5/11). Código en
`lib/whatsapp/cloud-api.ts` y `features/requests/server/whatsapp.service.ts`.

- **Entrada**: `/api/webhooks/whatsapp`. Meta suscribe con un GET (`hub.verify_token` =
  `WHATSAPP_VERIFY_TOKEN`) y manda cada evento firmado con el secreto de la app
  (`WHATSAPP_APP_SECRET`). Solo se leen los textos: uno con el código de una solicitud abierta
  guarda el `wa_id` y la hora, y se le confirma.
- **Salida**: `WHATSAPP_ACCESS_TOKEN` (usuario del sistema con `whatsapp_business_messaging`) y
  `WHATSAPP_PHONE_NUMBER_ID`. Dentro de las 24 h desde su último mensaje se escribe texto libre;
  después solo con una plantilla aprobada (`WHATSAPP_TEMPLATE_ATTEMPT_GRANTED`, cuerpo con `{{1}}`
  nombre y `{{2}}` examen, categoría «Utility»).
- **Antes de activarlo**: el número del negocio registrado en la cuenta de WhatsApp de ALBA, el
  webhook suscrito al campo `messages` en la app de Meta, la plantilla aprobada y las variables
  en Vercel. Hasta entonces el botón abre `wa.me` al número de soporte y el aviso queda en la
  plataforma.
