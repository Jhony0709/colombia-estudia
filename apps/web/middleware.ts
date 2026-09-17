/**
 * Next.js Middleware.
 * SSOT: plan/03-identidad-y-acceso.md "Middleware"
 *
 * Runs on the Edge for every request except assets.
 * Does exactly 5 things in order:
 * 1. Request ID
 * 2. Tenant host header (on the forwarded request headers)
 * 3. Session refresh with Supabase
 * 4. Redirect to login for protected pages without user (API routes answer 401 themselves)
 * 5. Security headers (CSP with nonce, HSTS, etc.)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isProtected, sanitizeNextUrl } from './lib/authz/routes';

// ─────────────────────────── Security Headers ───────────────────────────

/**
 * Generate a cryptographically random nonce for CSP.
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Content Security Policy.
 * SSOT: plan/04-seguridad.md "Cabeceras" (nonce + strict-dynamic, no unsafe-inline).
 * `unsafe-eval` only in development: Next's dev runtime (React Refresh) needs it.
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://*.supabase.co https://i.vimeocdn.com",
    "media-src 'self' https://*.supabase.co",
    'frame-src https://player.vimeo.com https://checkout.wompi.co',
    "connect-src 'self' https://*.supabase.co https://*.sentry.io",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Apply security headers to the response.
 * SSOT: plan/04-seguridad.md "Cabeceras"
 */
function applySecurityHeaders(response: NextResponse, csp: string, nonce: string): void {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  // Also exposed on the response so layouts/tests can read it; the authoritative copy for
  // Next is the request header set in middleware().
  response.headers.set('x-nonce', nonce);
}

// ─────────────────────────── Middleware ───────────────────────────

export async function middleware(request: NextRequest) {
  // ── 1. Request ID ──
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  // Everything the server side (getRequestContext, layouts) must see travels on the
  // *request* headers forwarded by NextResponse.next; response headers never reach
  // `headers()` in server components. The first version of this file set x-tenant-host
  // and x-nonce on the response only, so every request threw "middleware not running?".
  const nonce = generateNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  // ── 2. Tenant host: resolved (with cache) in getRequestContext(), never here (Edge) ──
  requestHeaders.set('x-tenant-host', request.nextUrl.hostname);
  // Next reads the nonce for its own inline scripts from the CSP *request* header.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ── 3. Session refresh with Supabase ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates against the server; getSession() only decodes the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 4. Protected routes without user: pages redirect to login; API routes get their
  //       401 JSON from the handler (withCapability / getRequestContext), never a redirect.
  const pathname = request.nextUrl.pathname;

  if (isProtected(pathname) && !user && !pathname.startsWith('/api/')) {
    const loginUrl = new URL('/auth/login', request.url);
    const next = sanitizeNextUrl(pathname + request.nextUrl.search);
    if (next !== '/') {
      loginUrl.searchParams.set('next', next);
    }
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Security headers + request id back to the client for support ──
  applySecurityHeaders(response, csp, nonce);
  response.headers.set('x-request-id', requestId);

  return response;
}

// ─────────────────────────── Matcher ───────────────────────────

/**
 * Matcher excludes static assets and Next.js internals.
 * SSOT: plan/03-identidad-y-acceso.md "config.matcher"
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf|eot|ico)).*)',
  ],
};
