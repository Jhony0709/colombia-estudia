/** @jest-environment node */
/**
 * WhatsApp Cloud API (5/11): el reto de suscripción, la firma de cada evento y qué mensajes se
 * leen. SSOT: lib/whatsapp/cloud-api.ts.
 */

import { createHmac } from 'node:crypto';
import { inboundMessages, verifyChallenge, verifySignature } from '@/lib/whatsapp/cloud-api';

beforeEach(() => {
  process.env.WHATSAPP_VERIFY_TOKEN = 'token-1';
  process.env.WHATSAPP_APP_SECRET = 'secreto';
});

afterEach(() => {
  delete process.env.WHATSAPP_VERIFY_TOKEN;
  delete process.env.WHATSAPP_APP_SECRET;
});

describe('verifyChallenge', () => {
  it('devuelve el reto solo con el token correcto', () => {
    const ok = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'token-1',
      'hub.challenge': '42',
    });
    expect(verifyChallenge(ok)).toBe('42');
    ok.set('hub.verify_token', 'otro');
    expect(verifyChallenge(ok)).toBeNull();
  });

  it('sin token configurado no suscribe a nadie', () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    const params = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.challenge': '42' });
    expect(verifyChallenge(params)).toBeNull();
  });
});

describe('verifySignature', () => {
  const body = '{"entry":[]}';
  const sign = (secret: string) =>
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('acepta la firma con el secreto de la app y rechaza las demás', () => {
    expect(verifySignature(body, sign('secreto'))).toBe(true);
    expect(verifySignature(body, sign('otro'))).toBe(false);
    expect(verifySignature(`${body} `, sign('secreto'))).toBe(false);
    expect(verifySignature(body, null)).toBe(false);
    expect(verifySignature(body, 'sha256=abc')).toBe(false);
  });

  it('sin secreto configurado no confía en nada', () => {
    delete process.env.WHATSAPP_APP_SECRET;
    expect(verifySignature(body, sign('secreto'))).toBe(false);
  });
});

describe('inboundMessages', () => {
  it('lee los mensajes, con el nombre del perfil y el número que recibió; no los estados', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn-1' },
                contacts: [{ wa_id: '573001112233', profile: { name: 'Laura' } }],
                messages: [
                  {
                    id: 'wamid.1',
                    from: '573001112233',
                    timestamp: '1793900000',
                    type: 'text',
                    text: { body: 'Hola' },
                  },
                  { id: 'wamid.2', from: '573001112233', type: 'image' },
                ],
                statuses: [{ id: 'wamid.0', status: 'read' }],
              },
            },
          ],
        },
      ],
    };
    expect(inboundMessages(payload)).toEqual([
      {
        id: 'wamid.1',
        from: '573001112233',
        name: 'Laura',
        phoneNumberId: 'pn-1',
        text: 'Hola',
        choiceId: null,
        at: new Date(1793900000 * 1000),
      },
      {
        id: 'wamid.2',
        from: '573001112233',
        name: 'Laura',
        phoneNumberId: 'pn-1',
        text: '[image]',
        choiceId: null,
        at: expect.any(Date),
      },
    ]);
    expect(inboundMessages(null)).toEqual([]);
  });
});

describe('inboundMessages: el menú', () => {
  it('una opción de la lista trae su id y su título', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn-1' },
                messages: [
                  {
                    id: 'wamid.3',
                    from: '573001112233',
                    timestamp: '1793900000',
                    type: 'interactive',
                    interactive: { list_reply: { id: 'asesor', title: 'Hablar con un asesor' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(inboundMessages(payload)[0]).toMatchObject({
      choiceId: 'asesor',
      text: 'Hablar con un asesor',
      name: null,
    });
  });
});

describe('inboundMessages: reacciones', () => {
  it('un 👍 a un mensaje no cuenta como mensaje', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.4', from: '573001112233', type: 'reaction' }],
              },
            },
          ],
        },
      ],
    };
    expect(inboundMessages(payload)).toEqual([]);
  });
});
