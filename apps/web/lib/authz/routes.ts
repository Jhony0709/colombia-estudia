/**
 * Route protection rules.
 * SSOT: plan/03-identidad-y-acceso.md "Middleware"
 *
 * Pure functions with tests. No side effects.
 */

// ─────────────────────────── Public Route Prefixes ───────────────────────────

/**
 * Prefixes that are public (no session required).
 * From prompt: /auth/*, /invitacion/*, /certificado/*, /api/health,
 * /api/auth/*, /api/invitations/*, and assets.
 *
 * AMBIGUO: /api/me was not in the original list but is marked "cualquiera" in
 * endpoints.md:24. Keeping it protected since it returns 401 without session.
 */
const PUBLIC_PREFIXES = [
  '/auth/',
  '/invitacion/',
  '/certificado/',
  '/api/health',
  '/api/auth/',
  '/api/invitations/',
  '/api/certificates/', // Public certificate verification (endpoints.md:42)
  '/api/webhooks/', // Webhooks are authenticated by signature, not session
  '/api/jobs/', // Jobs are authenticated by CRON_SECRET
] as const;

/**
 * Exact public paths (not prefixes).
 */
const PUBLIC_EXACT = ['/api/health'] as const;

// ─────────────────────────── Protection Check ───────────────────────────

/**
 * Check if a pathname is protected (requires authentication).
 *
 * @param pathname - The URL pathname (e.g., "/aprender/tema/123")
 * @returns true if the route requires authentication
 */
export function isProtected(pathname: string): boolean {
  // Exact matches first
  if ((PUBLIC_EXACT as readonly string[]).includes(pathname)) {
    return false;
  }

  // Prefix matches
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return false;
    }
  }

  // All API routes not explicitly public are protected
  // All page routes not explicitly public are protected
  return true;
}

// ─────────────────────────── Next URL Validation ───────────────────────────

/**
 * Validate the `next` query parameter for login redirects.
 *
 * Rules from plan/03: "next solo se acepta como ruta relativa del mismo origen"
 * - Must start with /
 * - Must not be a protocol-relative URL (//evil.com)
 * - Must not contain scheme (https://, http://)
 * - Must be on the same origin
 *
 * @param next - The next query parameter value
 * @returns true if the next URL is safe to redirect to
 */
export function isValidNextUrl(next: string | null | undefined): boolean {
  if (!next) {
    return false;
  }

  // Must start with /
  if (!next.startsWith('/')) {
    return false;
  }

  // Must not be protocol-relative (//evil.com)
  if (next.startsWith('//')) {
    return false;
  }

  // Must not contain a scheme (check for :// anywhere)
  if (next.includes('://')) {
    return false;
  }

  // Additional safety: no backslash (some browsers normalize \\ to //)
  if (next.includes('\\')) {
    return false;
  }

  return true;
}

/**
 * Sanitize the `next` URL - returns the URL if valid, or "/" otherwise.
 */
export function sanitizeNextUrl(next: string | null | undefined): string {
  return isValidNextUrl(next) ? next! : '/';
}
