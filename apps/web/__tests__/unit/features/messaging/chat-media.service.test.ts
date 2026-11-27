/** @jest-environment node */
/** Archivos del chat (27/11): se bajan de Meta al llegar y se borran con la conversación. */

const mockPrisma = {
  conversationMessage: { update: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
};
const mockDownload = jest.fn();
const mockPut = jest.fn();
const mockRemove = jest.fn();
const mockReadUrl = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return mockPrisma;
  },
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  downloadMedia: (...args: unknown[]) => mockDownload(...args),
}));
jest.mock('@/lib/media/storage', () => ({
  objectPath: ({ institutionId, kind, id, extension }: Record<string, string>) =>
    `institutions/${institutionId}/${kind}/${id}.${extension}`,
  putBytes: (...args: unknown[]) => mockPut(...args),
  removeObjects: (...args: unknown[]) => mockRemove(...args),
  createReadUrl: (...args: unknown[]) => mockReadUrl(...args),
}));

import {
  chatMediaHref,
  chatMediaUrl,
  extensionOf,
  playsInline,
  removeChatMedia,
  saveInboundMedia,
} from '@/features/messaging/server/chat-media.service';

const audio = {
  id: 'media-1',
  type: 'audio' as const,
  mime: 'audio/ogg; codecs=opus',
  filename: null,
  caption: null,
};

beforeEach(() => jest.clearAllMocks());

describe('extensionOf', () => {
  it('sale del tipo; un documento raro conserva la de su nombre', () => {
    expect(extensionOf('audio/ogg; codecs=opus', null)).toBe('ogg');
    expect(extensionOf('image/jpeg', null)).toBe('jpg');
    expect(extensionOf('application/vnd.ms-excel', 'notas.XLS')).toBe('xls');
    expect(extensionOf('application/x-raro', null)).toBe('bin');
  });
});

describe('saveInboundMedia', () => {
  it('baja el audio, lo guarda en el bucket y deja la ruta en el mensaje', async () => {
    const bytes = new ArrayBuffer(8);
    mockDownload.mockResolvedValue({ bytes, mime: 'audio/ogg' });
    await saveInboundMedia({ institutionId: 'inst-1', messageId: 'm-1', media: audio });

    expect(mockPut).toHaveBeenCalledWith('institutions/inst-1/chat/m-1.ogg', bytes, 'audio/ogg');
    expect(mockPrisma.conversationMessage.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { mediaPath: 'institutions/inst-1/chat/m-1.ogg' },
    });
  });

  it('si Meta ya no lo tiene o falla, el mensaje queda como estaba y no lanza', async () => {
    mockDownload.mockResolvedValueOnce(null);
    await saveInboundMedia({ institutionId: 'inst-1', messageId: 'm-1', media: audio });
    mockDownload.mockRejectedValueOnce(new Error('timeout'));
    await saveInboundMedia({ institutionId: 'inst-1', messageId: 'm-1', media: audio });

    expect(mockPut).not.toHaveBeenCalled();
    expect(mockPrisma.conversationMessage.update).not.toHaveBeenCalled();
  });
});

describe('playsInline', () => {
  it('audio, fotos comunes y video se ven; un SVG, un HTML o un PDF se descargan', () => {
    expect(playsInline('audio/ogg; codecs=opus')).toBe(true);
    expect(playsInline('image/jpeg')).toBe(true);
    expect(playsInline('video/mp4')).toBe(true);
    expect(playsInline('image/svg+xml')).toBe(false);
    expect(playsInline('text/html')).toBe(false);
    expect(playsInline('application/pdf')).toBe(false);
    expect(playsInline(null)).toBe(false);
  });
});

describe('chatMediaUrl', () => {
  const ids = { institutionId: 'inst-1', conversationId: 'conv-1', messageId: 'm-1' };

  it('busca el mensaje en esa conversación e institución, y firma en línea un audio', async () => {
    mockPrisma.conversationMessage.findFirst.mockResolvedValue({
      mediaPath: 'p/m-1.ogg',
      mediaMime: 'audio/ogg; codecs=opus',
      mediaName: null,
    });
    mockReadUrl.mockResolvedValue('https://signed/a');

    expect(await chatMediaUrl(ids)).toBe('https://signed/a');
    expect(mockPrisma.conversationMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'm-1',
        conversationId: 'conv-1',
        institutionId: 'inst-1',
        mediaPath: { not: null },
      },
      select: { mediaPath: true, mediaMime: true, mediaName: true },
    });
    expect(mockReadUrl).toHaveBeenCalledWith('p/m-1.ogg', { asAttachment: false });
  });

  it('un documento se firma como descarga con su nombre', async () => {
    mockPrisma.conversationMessage.findFirst.mockResolvedValue({
      mediaPath: 'p/m-1.pdf',
      mediaMime: 'application/pdf',
      mediaName: 'cedula.pdf',
    });
    await chatMediaUrl(ids);
    expect(mockReadUrl).toHaveBeenCalledWith('p/m-1.pdf', { fileName: 'cedula.pdf' });
  });

  it('de otra conversación o sin archivo: NOT_FOUND', async () => {
    mockPrisma.conversationMessage.findFirst.mockResolvedValue(null);
    await expect(chatMediaUrl(ids)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('la ruta estable', () => {
    expect(chatMediaHref('conv-1', 'm-1')).toBe('/api/conversations/conv-1/messages/m-1/media');
  });
});

describe('removeChatMedia', () => {
  it('borra del bucket los archivos de las conversaciones que se van a borrar', async () => {
    mockPrisma.conversationMessage.findMany.mockResolvedValue([{ mediaPath: 'p/a.ogg' }]);
    await removeChatMedia('inst-1', { personId: 'per-1' });

    expect(mockPrisma.conversationMessage.findMany).toHaveBeenCalledWith({
      where: {
        institutionId: 'inst-1',
        mediaPath: { not: null },
        conversation: { personId: 'per-1' },
      },
      select: { mediaPath: true },
    });
    expect(mockRemove).toHaveBeenCalledWith(['p/a.ogg']);
  });
});
