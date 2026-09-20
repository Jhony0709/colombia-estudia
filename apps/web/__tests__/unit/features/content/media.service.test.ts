/** @jest-environment node */
/**
 * El servicio de medios: la confirmación es la que manda.
 * SSOT: plan/04-seguridad.md:67-68, reference/02-api/endpoints.md:59-61.
 */

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockReadObjectHead = jest.fn();
const mockRemoveObject = jest.fn();
const mockCreateUploadUrl = jest.fn();
const mockGetVimeoVideo = jest.fn();
const mockGetVimeoTextTracks = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => {
    const tx = {
      mediaAsset: { findFirst: mockFindFirst, create: mockCreate, update: mockUpdate },
      auditLog: { create: mockAuditLogCreate },
    };
    return { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  }),
}));

jest.mock('@/lib/media/storage', () => ({
  objectPath: (args: { institutionId: string; kind: string; id: string; extension: string }) =>
    `institutions/${args.institutionId}/${args.kind.toLowerCase()}/${args.id}.${args.extension}`,
  pathBelongsTo: (path: string, institutionId: string) =>
    path.startsWith(`institutions/${institutionId}/`),
  createUploadUrl: (...args: unknown[]) => mockCreateUploadUrl(...args),
  readObjectHead: (...args: unknown[]) => mockReadObjectHead(...args),
  removeObject: (...args: unknown[]) => mockRemoveObject(...args),
}));

jest.mock('@/lib/media/vimeo', () => ({
  parseVimeoRef: jest.requireActual('@/lib/media/vimeo').parseVimeoRef,
  captionsSourceFor: jest.requireActual('@/lib/media/vimeo').captionsSourceFor,
  getVimeoVideo: (...args: unknown[]) => mockGetVimeoVideo(...args),
  getVimeoTextTracks: (...args: unknown[]) => mockGetVimeoTextTracks(...args),
}));

jest.mock('@/lib/observability/logger', () => ({ logger: { error: jest.fn() } }));

import {
  requestUpload,
  confirmUpload,
  registerVimeoVideo,
} from '@/features/content/server/media.service';

const svgBytes = new Uint8Array([...'<svg xmlns="x"/>'].map((c) => c.charCodeAt(0)));
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'asset1' });
  mockUpdate.mockResolvedValue({});
  mockCreateUploadUrl.mockResolvedValue({ signedUrl: 'https://x/upload', token: 'tok' });
  mockRemoveObject.mockResolvedValue(undefined);
});

describe('requestUpload', () => {
  it('la ruta lleva la institución delante y la extensión sale de la tabla, no del cliente', async () => {
    const ticket = await requestUpload({
      institutionId: 'inst1',
      actorId: 'p1',
      kind: 'IMAGE',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    });

    expect(ticket.path).toBe('institutions/inst1/image/asset1.jpg');
    expect(ticket.mediaAssetId).toBe('asset1');
  });

  it('nace PENDING', async () => {
    await requestUpload({
      institutionId: 'inst1',
      actorId: 'p1',
      kind: 'IMAGE',
      mimeType: 'image/png',
      sizeBytes: 1024,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', provider: 'STORAGE' }),
      })
    );
  });

  it('un SVG no llega ni a pedir sitio', async () => {
    await expect(
      requestUpload({
        institutionId: 'inst1',
        actorId: 'p1',
        kind: 'IMAGE',
        mimeType: 'image/svg+xml',
        sizeBytes: 1024,
      })
    ).rejects.toThrow(/SVG/);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCreateUploadUrl).not.toHaveBeenCalled();
  });
});

describe('confirmUpload', () => {
  const pendingAsset = {
    id: 'asset1',
    kind: 'IMAGE',
    provider: 'STORAGE',
    providerRef: 'institutions/inst1/image/asset1.png',
    status: 'PENDING',
    mimeType: 'image/png',
  };

  it('un SVG subido como .png se borra del bucket, se audita y se rechaza', async () => {
    mockFindFirst.mockResolvedValue(pendingAsset);
    mockReadObjectHead.mockResolvedValue({ bytes: svgBytes, sizeBytes: 120 });

    await expect(
      confirmUpload({ institutionId: 'inst1', actorId: 'p1', mediaAssetId: 'asset1' })
    ).rejects.toThrow(/SVG/);

    expect(mockRemoveObject).toHaveBeenCalledWith('institutions/inst1/image/asset1.png');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ERROR' } }));
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'media',
        action: 'rejected',
        after: expect.objectContaining({ actualFormat: 'svg', declaredMime: 'image/png' }),
      }),
    });
  });

  it('un PNG de verdad queda READY con el tamaño que hay en Storage', async () => {
    mockFindFirst.mockResolvedValue(pendingAsset);
    mockReadObjectHead.mockResolvedValue({ bytes: pngBytes, sizeBytes: 4096 });

    const result = await confirmUpload({
      institutionId: 'inst1',
      actorId: 'p1',
      mediaAssetId: 'asset1',
      altText: 'Un diagrama',
    });

    expect(result.status).toBe('READY');
    expect(mockRemoveObject).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'READY', sizeBytes: 4096, altText: 'Un diagrama' }),
      })
    );
  });

  it('no se puede confirmar dos veces', async () => {
    mockFindFirst.mockResolvedValue({ ...pendingAsset, status: 'READY' });

    await expect(
      confirmUpload({ institutionId: 'inst1', actorId: 'p1', mediaAssetId: 'asset1' })
    ).rejects.toThrow(/ya estaba confirmado/);
  });

  it('una ruta de otra institución no se lee ni se borra', async () => {
    mockFindFirst.mockResolvedValue({
      ...pendingAsset,
      providerRef: 'institutions/OTRA/image/asset1.png',
    });

    await expect(
      confirmUpload({ institutionId: 'inst1', actorId: 'p1', mediaAssetId: 'asset1' })
    ).rejects.toThrow(/no pertenece a la institución/);

    expect(mockReadObjectHead).not.toHaveBeenCalled();
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });
});

describe('registerVimeoVideo', () => {
  beforeEach(() => {
    mockGetVimeoVideo.mockResolvedValue({ id: '123', name: 'Clase 1', durationSeconds: 640 });
    mockGetVimeoTextTracks.mockResolvedValue([]);
  });

  it('acepta una URL y registra por id', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await registerVimeoVideo({
      institutionId: 'inst1',
      actorId: 'p1',
      input: 'https://vimeo.com/123',
    });

    expect(result.durationSeconds).toBe(640);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'VIMEO', providerRef: '123', kind: 'VIDEO' }),
      })
    );
  });

  it('sin subtítulos es NONE; con pistas, AUTO', async () => {
    mockFindFirst.mockResolvedValue(null);

    const sin = await registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: '123' });
    expect(sin.captionsSource).toBe('NONE');

    mockGetVimeoTextTracks.mockResolvedValue([
      { type: 'captions', language: 'es', name: 'es', link: 'https://x/a.vtt', active: true },
    ]);
    const con = await registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: '123' });
    expect(con.captionsSource).toBe('AUTO');
  });

  it('registrar dos veces el mismo video no lo duplica', async () => {
    mockFindFirst.mockResolvedValue({ id: 'ya', captionsSource: 'AUTO' });

    const result = await registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: '123' });

    expect(result.mediaAssetId).toBe('ya');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // La regla que protege la validación de publicación.
  it('una consulta a la API NO degrada un REVIEWED puesto por una persona', async () => {
    mockFindFirst.mockResolvedValue({ id: 'ya', captionsSource: 'REVIEWED' });

    await registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: '123' });

    const data = mockUpdate.mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty('captionsSource');
  });

  it('un video que Vimeo no conoce da NOT_FOUND, no un 500', async () => {
    mockGetVimeoVideo.mockResolvedValue(null);

    await expect(
      registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: '999' })
    ).rejects.toThrow(/no encuentra/);
  });

  it('acepta el código de inserción entero y avisa de que el video es no listado', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await registerVimeoVideo({
      institutionId: 'inst1',
      actorId: 'p1',
      input:
        '<iframe src="https://player.vimeo.com/video/123?h=abcdef0123&badge=0" ' +
        'width="640" height="360" allowfullscreen></iframe>',
    });

    expect(result.unlisted).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerRef: '123' }) })
    );
  });

  it('acepta la URL del panel de Vimeo, que es la que copia un autor', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await registerVimeoVideo({
      institutionId: 'inst1',
      actorId: 'p1',
      input: 'https://vimeo.com/manage/videos/123',
    });

    expect(result.unlisted).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerRef: '123' }) })
    );
  });

  it('el mismo video pegado como URL y como embed es UN solo registro', async () => {
    mockFindFirst.mockResolvedValue(null);
    await registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: 'https://vimeo.com/123' });

    mockFindFirst.mockResolvedValue({ id: 'asset1', captionsSource: 'AUTO' });
    const segundo = await registerVimeoVideo({
      institutionId: 'i',
      actorId: 'p',
      input: '<iframe src="https://player.vimeo.com/video/123?h=abcdef0123"></iframe>',
    });

    expect(segundo.mediaAssetId).toBe('asset1');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('una URL que no es de Vimeo se rechaza con mensaje, no con excepción de red', async () => {
    await expect(
      registerVimeoVideo({ institutionId: 'i', actorId: 'p', input: 'https://youtube.com/x' })
    ).rejects.toThrow(/No se reconoce ese video/);

    expect(mockGetVimeoVideo).not.toHaveBeenCalled();
  });
});
