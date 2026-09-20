/** @jest-environment node */
/**
 * La vista previa: qué assets se resuelven y con qué URL.
 * SSOT: plan/07-contenido-y-migracion.md:35.
 */

const mockMediaFindMany = jest.fn();
const mockVersionFindFirst = jest.fn();
const mockCreateReadUrl = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    mediaAsset: { findMany: (...args: unknown[]) => mockMediaFindMany(...args) },
    lessonVersion: { findFirst: (...args: unknown[]) => mockVersionFindFirst(...args) },
  })),
}));

jest.mock('@/lib/media/storage', () => ({
  createReadUrl: (...args: unknown[]) => mockCreateReadUrl(...args),
}));

import { previewDraft } from '@/features/content/server/preview.service';

const IMAGE_ID = 'cm1abcdefghijklmnopqrstuv';

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateReadUrl.mockResolvedValue('https://storage.test/firmada');
});

describe('previewDraft', () => {
  it('renderiza con el idioma del tema y dice qué assets faltan', async () => {
    mockVersionFindFirst.mockResolvedValue({
      content: `## Sección\n\nTexto.\n\n![Diagrama](asset:${IMAGE_ID})\n`,
      lesson: { language: 'es-CO' },
    });
    mockMediaFindMany.mockResolvedValue([]);

    const result = await previewDraft({ institutionId: 'i1', versionId: 'v1' });

    expect(result.html).toContain('<div lang="es-CO">');
    expect(result.html).toContain('<h2>Sección</h2>');
    expect(result.missingAssets).toEqual([IMAGE_ID]);
  });

  // Lo que sostiene el `dangerouslySetInnerHTML` de la pantalla.
  it('el HTML que devuelve viene saneado', async () => {
    mockVersionFindFirst.mockResolvedValue({
      content: '## S\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n',
      lesson: { language: 'es-CO' },
    });
    mockMediaFindMany.mockResolvedValue([]);

    const { html } = await previewDraft({ institutionId: 'i1', versionId: 'v1' });

    expect(html).not.toContain('script');
    expect(html).not.toContain('javascript:');
  });

  it('una versión que no existe da NOT_FOUND', async () => {
    mockVersionFindFirst.mockResolvedValue(null);

    await expect(previewDraft({ institutionId: 'i1', versionId: 'v9' })).rejects.toThrow(
      /not found/i
    );
  });
});
