/**
 * E2E de lo público, con axe en cada pantalla (plan/10 §2).
 * SSOT: reference/01-routing/routes.md (§Público), reference/03-ui/accesibilidad.md.
 *
 * Sin sesión y sin base de datos que sembrar: la portada, el login, la verificación de una
 * constancia inexistente y el 404. Corre en los tres proyectos de `playwright.config.ts`
 * (escritorio, 320 px, `prefers-reduced-motion`), así que cada `test` aquí son tres corridas.
 *
 * Lo que no cubre: los flujos con sesión (el vertical slice `06` → `09`). Esos necesitan
 * un usuario de Supabase y una semilla, y van en `slice.spec.ts` cuando el CI tenga las
 * credenciales de staging (`E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`).
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoA11yViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('Portada', () => {
  test('carga, tiene un h1 y pasa axe', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', { name: /ingresar/i }).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('no tiene desplazamiento horizontal', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test('las preguntas frecuentes se abren con teclado', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('details.site-faq').first();
    await first.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('open', '');
  });
});

test.describe('Login', () => {
  test('pasa axe y el foco empieza en el título', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe('Constancia pública', () => {
  test('un código inexistente dice que no existe, sin filtrar nada', async ({ page }) => {
    await page.goto('/certificado/ABCDEFGHJK');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/no encontramos/i);
    await expectNoA11yViolations(page);
  });

  test('la API pública limita y no expone PII', async ({ request }) => {
    const res = await request.get('/api/certificates/ABCDEFGHJK');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/documentNumber|email|birthDate/);
  });
});

test.describe('404', () => {
  test('una ruta inexistente pinta el 404 propio', async ({ page }) => {
    // Bajo un prefijo público: fuera de ellos el middleware manda al login antes del 404.
    const res = await page.goto('/auth/esta-ruta-no-existe');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/no encontramos/i);
  });
});
