import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-320px',
      use: {
        ...devices['iPhone SE'],
        // devices['iPhone SE'] trae defaultBrowserType: 'webkit'. Lo que este proyecto
        // comprueba es el reflow a 320px (WCAG 1.4.10), no Safari, y el CI solo instala
        // chromium: sin esto los 5 tests fallan por falta del binario de webkit.
        // Si algun dia se quiere cobertura real de Safari, se instala webkit en el job
        // `e2e` y se quita esta linea.
        browserName: 'chromium',
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        reducedMotion: 'reduce',
      },
    },
  ],
  webServer: {
    // CI runs against the production build (next start); locally the dev server is fine.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
