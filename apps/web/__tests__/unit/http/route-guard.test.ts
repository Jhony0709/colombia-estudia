/**
 * Route capability guard verification.
 * SSOT: plan/02-fundaciones.md §10
 *
 * Ensures every API route either:
 * - Has capability check (`capability:` or `withCapability(`)
 * - Is explicitly listed in PUBLIC_ROUTES with justification
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', 'app', 'api');

/**
 * Public routes with justification.
 * If a route is deleted or renamed, the test fails until the list is updated.
 * If a route gains capability protection, remove it from this list.
 */
const PUBLIC_ROUTES = new Map([
  ['health/route.ts', 'health check sin sesión'],
  ['auth/login/route.ts', 'endpoint de login'],
  ['auth/logout/route.ts', 'endpoint de logout'],
  ['auth/magic-link/route.ts', 'magic link sin sesión'],
  ['auth/recover/route.ts', 'recuperación sin sesión'],
  ['auth/reset/route.ts', 'reset con token de sesión (no capability)'],
  ['auth/mfa/enroll/route.ts', 'MFA requiere sesión, no capability'],
  ['auth/mfa/verify/route.ts', 'MFA requiere sesión, no capability'],
  ['auth/mfa/factors/route.ts', 'MFA requiere sesión, no capability'],
  ['invitations/[token]/route.ts', 'token = credencial'],
  ['invitations/[token]/accept/route.ts', 'token = credencial'],
  ['invitations/[token]/request-new/route.ts', 'público por diseño'],
  ['me/route.ts', 'comprueba ctx.person a mano; Deuda: migrar a capability'],
]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

const CAPABILITY_PATTERN = /capability\s*:|withCapability\s*\(/;

describe('route capability guard', () => {
  const routes = walk(ROOT);

  it('finds at least one route', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  describe('PUBLIC_ROUTES entries exist on disk', () => {
    it.each([...PUBLIC_ROUTES.keys()])('%s exists', (routeKey) => {
      const fullPath = join(ROOT, routeKey);
      expect(existsSync(fullPath)).toBe(true);
    });
  });

  describe('public routes do not have capability protection', () => {
    it.each([...PUBLIC_ROUTES.entries()])('%s (%s) has no capability', (routeKey) => {
      const fullPath = join(ROOT, routeKey);
      if (!existsSync(fullPath)) {
        // Already caught by "exists on disk" test
        return;
      }
      const source = readFileSync(fullPath, 'utf8');
      // If someone adds capability protection, remove from PUBLIC_ROUTES
      expect(CAPABILITY_PATTERN.test(source)).toBe(false);
    });
  });

  describe('protected routes have capability', () => {
    const protectedRoutes = routes.filter((routePath) => {
      const rel = relative(ROOT, routePath);
      return !PUBLIC_ROUTES.has(rel);
    });

    it.each(protectedRoutes)('%s has capability or withCapability', (routePath) => {
      const source = readFileSync(routePath, 'utf8');
      expect(CAPABILITY_PATTERN.test(source)).toBe(true);
    });
  });
});
