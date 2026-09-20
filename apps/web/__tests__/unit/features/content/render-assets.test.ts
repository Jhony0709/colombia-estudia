/** @jest-environment node */
/**
 * De `MediaAsset` a lo que el render necesita.
 * SSOT: plan/07-contenido-y-migracion.md:35, plan/08-aprender-y-evaluar.md:22-28.
 *
 * Dos consumidores dependen de esto —la vista previa del autor y el player del estudiante—
 * así que la regla de qué se pinta y con qué URL se prueba una sola vez, aquí.
 */

const mockMediaFindMany = jest.fn();
const mockCreateReadUrl = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    mediaAsset: { findMany: (...args: unknown[]) => mockMediaFindMany(...args) },
  })),
}));

jest.mock('@/lib/media/storage', () => ({
  createReadUrl: (...args: unknown[]) => mockCreateReadUrl(...args),
}));

import { resolveRenderAssets } from '@/features/content/server/render-assets';

const IMAGE_ID = 'cm1abcdefghijklmnopqrstuv';
const VIDEO_ID = 'cm2abcdefghijklmnopqrstuv';
const PDF_ID = 'cm3abcdefghijklmnopqrstuv';

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateReadUrl.mockResolvedValue('https://storage.test/firmada');
});

describe('resolveRenderAssets', () => {
  it('sin assets no toca la base', async () => {
    expect(await resolveRenderAssets({ institutionId: 'i1', assetIds: [] })).toEqual(new Map());
    expect(mockMediaFindMany).not.toHaveBeenCalled();
  });

  // Un archivo subido pero sin confirmar no ha pasado la comprobación de magic bytes.
  it('solo pide los READY', async () => {
    mockMediaFindMany.mockResolvedValue([]);

    await resolveRenderAssets({ institutionId: 'i1', assetIds: [IMAGE_ID] });

    expect(mockMediaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'READY', archivedAt: null }),
      })
    );
  });

  it('un video de Vimeo se pinta con la URL del reproductor', async () => {
    mockMediaFindMany.mockResolvedValue([
      {
        id: VIDEO_ID,
        kind: 'VIDEO',
        provider: 'VIMEO',
        providerRef: '123',
        altText: null,
        transcriptPath: null,
      },
    ]);

    const assets = await resolveRenderAssets({ institutionId: 'i1', assetIds: [VIDEO_ID] });

    expect(assets.get(VIDEO_ID)?.src).toBe('https://player.vimeo.com/video/123');
    expect(mockCreateReadUrl).not.toHaveBeenCalled();
  });

  // Un `attachment` en una imagen haría que el navegador la ofreciera como descarga.
  it('una imagen se muestra y un documento se descarga', async () => {
    mockMediaFindMany.mockResolvedValue([
      {
        id: IMAGE_ID,
        kind: 'IMAGE',
        provider: 'STORAGE',
        providerRef: 'p/i.png',
        altText: 'Alt',
        transcriptPath: null,
      },
      {
        id: PDF_ID,
        kind: 'DOCUMENT',
        provider: 'STORAGE',
        providerRef: 'p/g.pdf',
        altText: null,
        transcriptPath: null,
      },
    ]);

    await resolveRenderAssets({ institutionId: 'i1', assetIds: [IMAGE_ID, PDF_ID] });

    expect(mockCreateReadUrl).toHaveBeenCalledWith('p/i.png', { asAttachment: false });
    expect(mockCreateReadUrl).toHaveBeenCalledWith('p/g.pdf', { asAttachment: true });
  });

  it('un proveedor que no usamos no se pinta', async () => {
    mockMediaFindMany.mockResolvedValue([
      {
        id: VIDEO_ID,
        kind: 'VIDEO',
        provider: 'YOUTUBE',
        providerRef: 'abc',
        altText: null,
        transcriptPath: null,
      },
    ]);

    const assets = await resolveRenderAssets({ institutionId: 'i1', assetIds: [VIDEO_ID] });

    expect(assets.size).toBe(0);
  });
});
