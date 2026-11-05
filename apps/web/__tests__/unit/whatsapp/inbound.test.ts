/** @jest-environment node */
/**
 * Lo que llega por WhatsApp (5/11): un mensaje con el código de una solicitud abierta la enlaza
 * a ese chat; sin código no se toca nada. SSOT: features/requests/server/whatsapp.service.ts.
 */

const mockGlobalFind = jest.fn();
const mockUpdate = jest.fn();
const mockSendText = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  prisma: { accessRequest: { findFirst: (...args: unknown[]) => mockGlobalFind(...args) } },
  createTenantClient: jest.fn(() => ({ accessRequest: { update: mockUpdate } })),
}));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  sendText: (...args: unknown[]) => mockSendText(...args),
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));

import { handleInboundMessage } from '@/features/requests/server/whatsapp.service';

const CODE = 'cmh1abcdefghijklmnopqrstu';
const AT = new Date('2026-11-05T15:00:00.000Z');
const message = (text: string) => ({
  id: 'wamid.1',
  from: '573001112233',
  name: 'Laura',
  phoneNumberId: 'pn-1',
  text,
  choiceId: null,
  at: AT,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSendText.mockResolvedValue({ sent: true, id: 'wamid.r' });
});

describe('handleInboundMessage', () => {
  it('sin código no busca ni responde', async () => {
    expect(await handleInboundMessage(message('Hola, necesito ayuda'))).toBe('no_code');
    expect(mockGlobalFind).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('con el código de una abierta guarda el chat y le confirma', async () => {
    mockGlobalFind.mockResolvedValue({ id: CODE, institutionId: 'inst-1', status: 'PENDING' });

    expect(await handleInboundMessage(message(`Quiero otra oportunidad. Código: ${CODE}`))).toBe(
      'linked'
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: CODE },
      data: { whatsappId: '573001112233', whatsappAt: AT },
    });
    expect(mockSendText).toHaveBeenCalledWith('573001112233', expect.any(String), 'pn-1');
  });

  it('una ya cerrada no se toca: se le dice que se resolvió', async () => {
    mockGlobalFind.mockResolvedValue({ id: CODE, institutionId: 'inst-1', status: 'DONE' });

    expect(await handleInboundMessage(message(`Código: ${CODE}`))).toBe('closed');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('un código que no existe no hace nada', async () => {
    mockGlobalFind.mockResolvedValue(null);
    expect(await handleInboundMessage(message(`Código: ${CODE}`))).toBe('unknown_code');
    expect(mockSendText).not.toHaveBeenCalled();
  });
});
