/** @jest-environment node */
/**
 * La allowlist de subida.
 * SSOT: plan/04-seguridad.md:63-69 y su tabla de amenazas (línea 20, "SVG prohibido").
 */

import { checkUploadRequest, MAX_BYTES, ALLOWED } from '@/lib/media/limits';

const MB = 1024 * 1024;

describe('checkUploadRequest', () => {
  it('acepta un PNG de tamaño razonable y decide la extensión', () => {
    const result = checkUploadRequest('IMAGE', 'image/png', 2 * MB);

    expect(result.ok).toBe(true);
    expect(result.extension).toBe('png');
  });

  it('rechaza SVG con un mensaje que dice qué hacer', () => {
    const result = checkUploadRequest('IMAGE', 'image/svg+xml', 1024);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('PNG');
  });

  it('respeta los tamaños del plan por tipo', () => {
    expect(MAX_BYTES.IMAGE).toBe(10 * MB);
    expect(MAX_BYTES.DOCUMENT).toBe(50 * MB);
    expect(MAX_BYTES.AUDIO).toBe(100 * MB);
    expect(MAX_BYTES.SUBMISSION).toBe(20 * MB);
  });

  it('rechaza lo que pasa del límite y dice cuánto pesa y cuánto cabe', () => {
    const result = checkUploadRequest('IMAGE', 'image/png', 11 * MB);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('11 MB');
    expect(result.message).toContain('10 MB');
  });

  it('un PDF no se cuela por la puerta de las imágenes', () => {
    expect(checkUploadRequest('IMAGE', 'application/pdf', 1024).ok).toBe(false);
    expect(checkUploadRequest('DOCUMENT', 'application/pdf', 1024).ok).toBe(true);
  });

  it('rechaza tamaños imposibles', () => {
    expect(checkUploadRequest('IMAGE', 'image/png', 0).ok).toBe(false);
    expect(checkUploadRequest('IMAGE', 'image/png', -1).ok).toBe(false);
    expect(checkUploadRequest('IMAGE', 'image/png', 1.5).ok).toBe(false);
  });

  it('el MIME no distingue mayúsculas', () => {
    expect(checkUploadRequest('IMAGE', 'IMAGE/PNG', 1024).ok).toBe(true);
  });

  it('ningún tipo admite SVG, mire donde se mire', () => {
    for (const kind of Object.keys(ALLOWED) as Array<keyof typeof ALLOWED>) {
      expect(Object.keys(ALLOWED[kind])).not.toContain('image/svg+xml');
    }
  });
});
