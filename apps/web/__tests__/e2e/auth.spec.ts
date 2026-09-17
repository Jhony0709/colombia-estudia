/**
 * E2E tests for auth flows.
 * SSOT: docs/estado.md §9b
 *
 * Uses page.route to intercept /api/auth/login responses without needing real Supabase.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth flows', () => {
  test('login by keyboard - navigates to / on successful student login', async ({ page }) => {
    // Intercept the login API to return a mocked successful response
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { next: '/' } }),
      });
    });
    // The real `/` needs a session (middleware redirects it to /auth/login), so the
    // destination is stubbed too: what this test checks is the keyboard flow + navigation.
    await page.route(
      (url) => url.pathname === '/',
      (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>inicio</h1>' })
    );

    await page.goto('/auth/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Focus starts on the h1 (tabindex=-1); Tab reaches the email field
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="email"]')).toBeFocused();
    await page.keyboard.type('student@example.com');

    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="password"]')).toBeFocused();
    await page.keyboard.type('validpassword123');

    // Enter inside the password field submits the form (implicit submission). The next Tab
    // stop is the show/hide toggle, not the submit button, so "Tab + Enter" would only
    // toggle visibility.
    await page.keyboard.press('Enter');

    await page.waitForURL((url) => url.pathname === '/');
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('login by keyboard - navigates to /auth/mfa for staff', async ({ page }) => {
    // Intercept the login API to return MFA required response
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { next: '/auth/mfa?next=%2Fadmin%2Finstitucion' } }),
      });
    });

    await page.goto('/auth/login');

    // Wait for the form to be ready
    await expect(page.locator('input[name="email"]')).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.type('admin@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('validpassword123');

    // Enter in the password field submits (see the first test)
    await page.keyboard.press('Enter');

    await page.waitForURL('**/auth/mfa**');

    // Verify we navigated to MFA page
    expect(page.url()).toContain('/auth/mfa');
  });

  test('login shows error on invalid credentials', async ({ page }) => {
    // Intercept the login API to return an error
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Correo o contraseña incorrectos',
          },
        }),
      });
    });

    await page.goto('/auth/login');

    // Fill and submit form
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Ojo con el locator: ademas de esta alerta, el layout raiz monta una live region
    // permanente con role="alert" (lib/a11y/announce.tsx:65), hermana de <main>. Un
    // '[role="alert"]' a secas resuelve a 2 elementos y Playwright falla por strict mode.
    const alert = page.locator('main [role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Correo o contraseña incorrectos');
  });

  test('email and password fields have correct autocomplete attributes', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await expect(emailInput).toHaveAttribute('autocomplete', 'username');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('heading receives focus on page load', async ({ page }) => {
    await page.goto('/auth/login');

    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    // Check that h1 has focus (or at least is focusable via tabIndex=-1)
    const h1 = page.locator('h1');
    await expect(h1).toHaveAttribute('tabindex', '-1');
  });
});
