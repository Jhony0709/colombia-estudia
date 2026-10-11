/** SEO-14 (docs/seo/auditoria-2026-10.md). Sin `VERCEL_ENV`, robots es el de «no rastrear». */

import { test, expect } from '@playwright/test';

test.describe('Rastreo', () => {
  test('robots.txt es texto, no el login', async ({ request }) => {
    const res = await request.get('/robots.txt', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^text\/plain/);
    expect(await res.text()).toMatch(/Disallow: \//);
  });

  test('sitemap.xml lista las páginas indexables', async ({ request }) => {
    const res = await request.get('/sitemap.xml', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const body = await res.text();
    for (const path of ['/</loc>', '/registro</loc>', '/auth/login</loc>']) {
      expect(body).toContain(path);
    }
  });

  test('una ruta privada inexistente va al login (default-deny, Anexo A)', async ({ request }) => {
    const res = await request.get('/ruta-que-no-existe', { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()['location']).toContain('/auth/login');
  });
});

test.describe('Metadatos', () => {
  test('la portada: título, canonical, OG y JSON-LD', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/bachillerato/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = JSON.parse(raw ?? '{}')['@graph'] as Array<Record<string, unknown>>;
    expect(graph.find((node) => node['@type'] === 'WebSite')?.name).toBe('ALBA Futuro Educativo');
  });

  for (const path of ['/auth/login', '/registro']) {
    test(`${path} es indexable y lleva la marca (D3)`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(/· ALBA Futuro Educativo$/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`${path}$`)
      );
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    });
  }

  for (const path of ['/auth/recuperar', '/certificado/ABCDEFGHJK']) {
    test(`${path} no se indexa`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
  }
});
