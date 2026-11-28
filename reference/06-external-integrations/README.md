# 06 — Integraciones externas

| Servicio                                  | Para qué                                                                                                                                                         | Estado MVP                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Supabase Auth                             | Identidad. Invitación por email; recuperación de contraseña; sin auto-registro                                                                                   | MVP                                                               |
| Supabase Storage                          | Imágenes, PDFs, audio, transcripciones. Buckets privados, URLs firmadas. Confirmación por `POST /api/media/[id]/confirm` (no hay webhooks firmados)              | MVP                                                               |
| **Vimeo**                                 | **Todo el video.** Los 130 temas con video ya están ahí; se conservan los ids                                                                                    | MVP                                                               |
| OCR (Tesseract o modelo de visión)        | Pipeline de migración: imagen de página → Markdown borrador                                                                                                      | MVP (herramienta, no runtime)                                     |
| Resend                                    | Invitaciones, recuperación, recordatorios, avisos. Remitente por institución sobre un dominio verificado                                                         | MVP (Free)                                                        |
| Sentry                                    | Errores, desde el primer handler                                                                                                                                 | MVP (Free)                                                        |
| Vercel Cron                               | El job diario                                                                                                                                                    | MVP                                                               |
| Expo Push Service (27/11)                 | Push a la app del equipo, con `fetch`: hasta 100 por petición y el recibo a los 15 min. Sin SLA: la campana manda                                                | App móvil (gratis)                                                |
| **Bold** (18/11; antes Wompi)             | Pago en línea de cuotas (tarjeta, PSE, Nequi, Botón Bancolombia): link de pago por API + webhook firmado + consulta de notificaciones. Tarifa en bold.co/tarifas | MVP (paridad con la propuesta competidora)                        |
| **WhatsApp Cloud API** (5/11)             | Otra oportunidad en un examen: webhook firmado que enlaza la solicitud con el chat y aviso al estudiante cuando operación la concede                             | Sin variables, solo el aviso de la plataforma y el enlace `wa.me` |
| Zoom / Meet                               | Solo el enlace de la sesión en vivo; sin API                                                                                                                     | MVP                                                               |
| Proveedor de facturación electrónica DIAN | La factura legal; guardamos `externalInvoiceRef`                                                                                                                 | Fase 2 — cotizar                                                  |
| Mux                                       | Video adaptativo propio                                                                                                                                          | **No**. Vimeo ya lo da                                            |

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

## Bold (18/11, reemplaza a Wompi)

Código en `lib/billing/bold.ts` y `features/billing/server/account.service.ts`.

**Flujo** (19/11): «Pagar en línea» crea un link de pago por API (`POST /online/link/v1`, monto
cerrado en pesos, `reference` = `ce-{cuota}-{intento}`), lo guarda en `PaymentLink` y redirige a
su URL. Un link vigente por el mismo monto se reutiliza.

**Tres formas de entregarlo** (19/11; Bold no deja cancelar un link, así que la vigencia es el
único límite): «Pagar en línea» redirige y el link dura **1 hora**; «Enviarme el link al correo»
(y «Enviar al correo» desde una conversación de `/mensajes`) hace que Bold lo envíe con
`payer_email` y dura **24 horas**; «Dejar en el chat» lo manda por WhatsApp como mensaje de
quien atiende, también 24 horas. Por correo siempre es un link nuevo (Bold solo lo envía al
crearlo), como mucho uno cada 5 minutos por cuota. En pruebas Bold no manda correos.

Un pago solo
se da por hecho cuando **Bold dice que el link está pagado** (`GET /online/link/v1/{id}` →
`PAID`); hay tres avisos para ir a preguntarlo:

1. la vuelta del pago (`callback_url` → `?pago=<referencia>`): se consulta al cargar la página;
2. el webhook `/api/webhooks/bold` (`SALE_APPROVED`, `SALE_REJECTED`, `VOID_APPROVED`),
   verificado con `x-bold-signature` (HMAC-SHA256 del cuerpo en Base64 con `BOLD_SECRET_KEY`).
   El evento no se cree: solo dispara la consulta. Bold puede tardar hasta 10 minutos en mandarlo;
3. el job diario, para los links abiertos de más de 10 minutos.

El paso del link a `PAID` (un `updateMany` condicionado, en la misma transacción que crea el
`Payment`) hace que el pago se registre una sola vez aunque lleguen los tres.

**Llaves**: Integraciones › Llaves de integración en el panel de Bold. `BOLD_API_KEY` es la llave
de identidad y `BOLD_SECRET_KEY` la secreta. Con las de prueba va `BOLD_SANDBOX=true`: Bold firma
los eventos con llave vacía, así que ese modo **se ignora en producción** (`VERCEL_ENV`).
El webhook se registra en Integraciones › Webhooks.

**Casos y qué pasa en cada uno** (tests en `__tests__/unit/features/billing/account.service.test.ts`):

| Caso                                        | Resultado                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Aprobado por lo pendiente                   | `Payment` confirmado, cuota recalculada; al volver: «Recibimos tu pago»             |
| Aprobado por otro monto                     | `Payment` sin confirmar y aviso a operación; al volver: «lo revisamos»              |
| Rechazado o fallido                         | Sin pago; aviso al pagador; el link deja de ofrecerse y el siguiente clic crea otro |
| En proceso (PSE)                            | Sin pago aún; al volver: «en proceso»; lo cierra el webhook o el job                |
| Vuelve sin pagar                            | «En proceso»; el link sigue vigente y se reutiliza                                  |
| Link vencido (1 h o 24 h)                   | Pasa a `EXPIRED`; el siguiente clic crea otro                                       |
| Webhook repetido, o webhook + vuelta + job  | Un solo `Payment` (`duplicate`)                                                     |
| Webhook perdido                             | Lo registra la vuelta del pago o el job diario                                      |
| Webhook «aprobado» que Bold no confirma     | Sin pago; responde 503 y Bold reintenta (15 min, 1 h, 4 h, 8 h, 24 h)               |
| Firma inválida                              | 401, sin tocar nada                                                                 |
| Venta que no es de la plataforma (datáfono) | 200 `unknown_reference`, sin consultar a Bold                                       |
| Anulación en Bold (`VOID_APPROVED`)         | Aviso a operación; el pago se anula a mano en cartera, con motivo                   |
| Bold caído al crear el link                 | «No se pudo abrir el pago en línea»; transferencia sigue disponible                 |

**Probar con las llaves de prueba** (developers.bold.co › Botón de pagos › Ambiente de pruebas):
el checkout muestra «Modo de pruebas» y no cobra. Tarjetas: `4111 1111 1111 1111` y
`5100 0100 0000 0015` aprueban, `4970 1100 0000 0062` rechaza, `5204 7300 0000 8404` falla. PSE:
«BANCO QUE APRUEBA», «BANCO QUE RECHAZA», «BANCO QUE SIMULA UN ERROR». Con otros datos, todo se
rechaza. En pruebas Bold **no manda el webhook solo**: el comprobante trae «Probar el webhook»
(pide la URL y la llave de identidad de pruebas). La vuelta del pago funciona igual donde el sitio
va por `https`; en `localhost` Bold no acepta la `callback_url`, así que tras pagar se abre a mano
`/aprender/mi-cuenta?pago=<referencia>`. Las llamadas a Bold tienen un límite de 8 segundos.
`node packages/scripts/bold/check.mjs` crea un link de prueba y lo consulta. Comprobado con él
el 19/11: `expiration_date` va en **nanosegundos** (en milisegundos Bold responde 400 `PL_000`),
la consulta devuelve nuestra `reference` y los montos mínimo y máximo de la cuenta son $1.000 y
$10.000.000 (tarjeta, PSE y Nequi).

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
- **Bandeja** (22/11): las respuestas desde `/mensajes` pueden citar un mensaje (`context.message_id`)
  y llevar hasta 3 botones de respuesta; lo que la persona cita llega en `context.id` y se enlaza.
  Fuera de las 24 h se retoma con `WHATSAPP_TEMPLATE_FOLLOW_UP` (`{{1}}` nombre, «Utility»).
- **Archivos** (27/11): audios, fotos, videos, documentos y stickers llegan con un `media.id`.
  Al recibirlos se bajan (`GET /{media-id}` → URL que caduca, pedida con el mismo token; tope
  20 MB) y se guardan en el bucket privado `media` (`institutions/{id}/chat/{mensaje}.{ext}`).
  La bandeja los pide a `GET /api/conversations/[id]/messages/[id]/media`, que firma en cada
  pedido; se borran con la conversación (retención y anonimización). La descarga corre después de
  responder al webhook (`after`); si falla, el mensaje queda como `[audio]`.
- **Avisos al asesor** (27/11): un mensaje nuevo en el chat que atiende, si no lo tiene abierto
  (`Conversation.agentSeenAt`, que marca la bandeja cada 10 s), y recordatorios a los 10 y 30 min
  de lo que sigue sin tomar o sin respuesta, en horario de asesores. Campana y plantilla
  `WHATSAPP_TEMPLATE_PENDING_MESSAGE` a su WhatsApp (`features/messaging/server/agent-alerts.service.ts`).
- **Leído y «escribiendo…»** (22/11): cada mensaje que contesta el bot se marca con
  `status: read` y `typing_indicator` (`markRead`, `lib/whatsapp/cloud-api.ts`).
- **Antes de activarlo**: el número del negocio registrado en la cuenta de WhatsApp de ALBA, el
  webhook suscrito al campo `messages` en la app de Meta, la plantilla aprobada y las variables
  en Vercel. Hasta entonces el botón abre `wa.me` al número de soporte y el aviso queda en la
  plataforma.
