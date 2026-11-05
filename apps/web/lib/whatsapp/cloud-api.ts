/**
 * WhatsApp Cloud API (Meta): verificar el webhook, leer los mensajes que llegan y escribir al
 * estudiante. SSOT: reference/06-external-integrations/README.md (WhatsApp).
 *
 * Cada cosa con su variable:
 * - `WHATSAPP_VERIFY_TOKEN` responde el reto con que Meta suscribe el webhook (GET);
 * - `WHATSAPP_APP_SECRET` verifica la firma `X-Hub-Signature-256` de cada evento (POST);
 * - `WHATSAPP_ACCESS_TOKEN` envía desde el número de la institución
 *   (`Institution.whatsappPhoneNumberId`, o `WHATSAPP_PHONE_NUMBER_ID` si no lo tiene).
 *
 * Sin configurar no falla nada: no se envía y quien llama sigue con el aviso de la plataforma.
 */

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const GRAPH_URL = 'https://graph.facebook.com';

/** Dentro de las 24 h desde su último mensaje se le escribe libre; después, solo con plantilla. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** El número del negocio para `wa.me`; nulo si no está, y entonces se usa el de soporte. */
export function businessPhone(): string | null {
  return process.env.WHATSAPP_BUSINESS_PHONE || null;
}

/** El reto de suscripción del webhook: devuelve `hub.challenge` si el token coincide. */
export function verifyChallenge(params: URLSearchParams): string | null {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return null;
  if (params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== token) {
    return null;
  }
  return params.get('hub.challenge');
}

/** `X-Hub-Signature-256`: HMAC-SHA256 del cuerpo crudo con el secreto de la app. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface InboundMessage {
  id: string;
  /** `wa_id` de quien escribe: el número con indicativo, solo dígitos. */
  from: string;
  /** El nombre de su perfil de WhatsApp, si vino. */
  name: string | null;
  /** El número del negocio que recibió: con él se encuentra la institución. */
  phoneNumberId: string | null;
  /** Lo que escribió; en una opción del menú, su título; en un archivo, `[image]`, `[audio]`… */
  text: string;
  /** La opción del menú que eligió (id de la fila o del botón); nulo si escribió. */
  choiceId: string | null;
  at: Date;
}

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            list_reply?: { id?: string; title?: string };
            button_reply?: { id?: string; title?: string };
          };
          button?: { payload?: string; text?: string };
        }>;
      };
    }>;
  }>;
}

/** Los mensajes de un evento; los estados de entrega no se leen. */
export function inboundMessages(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of (payload as WebhookPayload)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const m of value?.messages ?? []) {
        // Una reacción (👍 a un mensaje) no es algo que contestar: el bot volvería a saludar.
        if (!m.id || !m.from || !m.type || m.type === 'reaction') continue;
        const reply = m.interactive?.list_reply ?? m.interactive?.button_reply;
        const choiceId = reply?.id ?? m.button?.payload ?? null;
        const text =
          m.type === 'text'
            ? (m.text?.body ?? '')
            : (reply?.title ?? m.button?.text ?? `[${m.type}]`);
        const seconds = Number(m.timestamp);
        out.push({
          id: m.id,
          from: m.from,
          name: value?.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null,
          phoneNumberId: value?.metadata?.phone_number_id ?? null,
          text,
          choiceId,
          at: Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(),
        });
      }
    }
  }
  return out;
}

export type SendResult = { sent: true; id: string | null } | { sent: false; reason: string };

/** `phoneNumberId`: el número de la institución; sin él, el de `WHATSAPP_PHONE_NUMBER_ID`. */
async function send(
  to: string,
  message: Record<string, unknown>,
  phoneNumberId?: string | null
): Promise<SendResult> {
  const from = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !from) return { sent: false, reason: 'not_configured' };
  const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
  const url = `${GRAPH_URL}/${version}/${from}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    } | null;
    if (!res.ok) return { sent: false, reason: json?.error?.message ?? `http_${res.status}` };
    return { sent: true, id: json?.messages?.[0]?.id ?? null };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'network' };
  }
}

export function sendText(
  to: string,
  body: string,
  phoneNumberId?: string | null
): Promise<SendResult> {
  return send(to, { type: 'text', text: { body, preview_url: false } }, phoneNumberId);
}

export interface ListOption {
  /** Lo que vuelve en `choiceId` cuando la elige. */
  id: string;
  /** Hasta 24 caracteres. */
  title: string;
  /** Hasta 72 caracteres. */
  description?: string;
}

/** Un mensaje con menú (lista interactiva): hasta 10 opciones tras un botón. */
export function sendList(
  to: string,
  list: { body: string; button: string; options: ListOption[] },
  phoneNumberId?: string | null
): Promise<SendResult> {
  return send(
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: list.body },
        action: {
          button: list.button,
          sections: [{ title: 'Opciones', rows: list.options }],
        },
      },
    },
    phoneNumberId
  );
}

/**
 * Una plantilla aprobada en Meta; `params` llena `{{1}}`, `{{2}}`… del cuerpo, en orden.
 * `urlSuffix` llena la parte variable del primer botón de enlace, si la plantilla lo tiene.
 */
export function sendTemplate(
  to: string,
  name: string,
  params: string[],
  options: { phoneNumberId?: string | null; urlSuffix?: string } = {}
): Promise<SendResult> {
  const components: Array<Record<string, unknown>> = [];
  if (params.length) {
    components.push({ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) });
  }
  if (options.urlSuffix) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: options.urlSuffix }],
    });
  }
  return send(
    to,
    {
      type: 'template',
      template: {
        name,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_CO' },
        components,
      },
    },
    options.phoneNumberId
  );
}
