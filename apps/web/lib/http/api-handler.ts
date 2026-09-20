/**
 * Unified API handler wrapper.
 * SSOT: plan/01-arquitectura-y-estructura.md §"Un request, de punta a punta"
 *
 * Provides: request ID, Zod validation, CSRF protection, capability checking,
 * error handling, logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { getRequestId } from '../observability/request-id';
import { logger, hashPersonId } from '../observability/logger';
import { APIError, isAPIError } from '../core/errors';
import { success, error } from './responses';
import { revalidateStaffPages } from './revalidate';
import type { Capability } from '@colombia-estudia/domain';

// ─────────────────────────── Context ───────────────────────────

export interface RequestContext {
  requestId: string;
  institutionId?: string;
  personId?: string;
  params: Promise<Record<string, string | string[] | undefined>>;
}

// ─────────────────────────── Options ───────────────────────────

interface HandlerOptions<TInput> {
  schema?: ZodSchema<TInput>;
  /**
   * Capability required for this handler.
   * If specified, the handler will check that the user has this capability.
   * For resource-level scope checking, use withCapability instead.
   */
  capability?: Capability;
}

type Handler<TInput, TOutput> = (
  req: NextRequest,
  ctx: RequestContext,
  input: TInput
) => Promise<TOutput | NextResponse>;

// ─────────────────────────── CSRF Check ───────────────────────────

function checkCsrf(req: NextRequest): boolean {
  // Only check non-safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  const secFetchSite = req.headers.get('sec-fetch-site');
  const origin = req.headers.get('origin');
  const requestHost = req.nextUrl.host;

  // If Sec-Fetch-Site is present and not same-origin/none, reject
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return false;
  }

  // If Origin is present and doesn't match request host, reject
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== requestHost) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

// ─────────────────────────── Handler ───────────────────────────

export function apiHandler<TInput = unknown, TOutput = unknown>(
  options: HandlerOptions<TInput> = {}
) {
  return (handler: Handler<TInput, TOutput>) => {
    return async (
      req: NextRequest,
      routeContext?: { params?: Promise<Record<string, string | string[] | undefined>> }
    ): Promise<NextResponse> => {
      const start = Date.now();
      const requestId = getRequestId(req);
      const route = req.nextUrl.pathname;

      const ctx: RequestContext = {
        requestId,
        params: routeContext?.params ?? Promise.resolve({}),
      };

      try {
        // CSRF check
        if (!checkCsrf(req)) {
          return error('FORBIDDEN_ORIGIN', 'Cross-origin request rejected', 403);
        }

        // Parse input
        let input: TInput = {} as TInput;
        if (options.schema) {
          let body: unknown;
          if (req.method === 'GET') {
            body = Object.fromEntries(req.nextUrl.searchParams);
          } else {
            try {
              body = await req.json();
            } catch {
              return error('VALIDATION_ERROR', 'Invalid JSON body', 400);
            }
          }
          input = options.schema.parse(body);
        }

        // Capability check (simple check without resource loading)
        // For resource-level scope checking, use withCapability wrapper instead
        if (options.capability) {
          // Dynamically import to avoid circular dependencies and keep
          // the handler lightweight when capability is not needed
          const { getRequestContext } = await import('../authz/request-context');
          const authCtx = await getRequestContext();

          // Fill in context for logging
          ctx.institutionId = authCtx.institution.id;
          ctx.personId = authCtx.person?.id;

          if (!authCtx.person) {
            throw new APIError('Authentication required', 'UNAUTHENTICATED');
          }

          const scopes = authCtx.capabilities.get(options.capability);
          if (!scopes || scopes.length === 0) {
            throw new APIError(
              `Missing capability: ${options.capability}`,
              'INSUFFICIENT_CAPABILITY'
            );
          }
        }

        // Execute handler
        const result = await handler(req, ctx, input);

        // Una escritura deja viejas las pantallas de staff, que son Server Components y leen
        // de la base al renderizar. Va aquí, en el único sitio por el que pasan todas las
        // rutas, y no repetido en cada una: una lista de doce llamadas a `revalidatePath` es
        // una lista de doce sitios donde olvidarse de la número trece. Ver
        // `lib/http/revalidate.ts` para por qué `router.refresh()` solo no basta.
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          revalidateStaffPages();
        }

        // If handler returns a Response (NextResponse or a plain Response, e.g. a redirect),
        // use it directly. NextResponse extends Response, so checking Response covers both.
        if (result instanceof Response) {
          const durationMs = Date.now() - start;
          const status = result.status;
          logger.info({
            requestId,
            route,
            method: req.method,
            status,
            durationMs,
            ...(ctx.institutionId && { institutionId: ctx.institutionId }),
            ...(ctx.personId && { personIdHash: hashPersonId(ctx.personId) }),
          });
          return result;
        }

        const durationMs = Date.now() - start;
        logger.info({
          requestId,
          route,
          method: req.method,
          status: 200,
          durationMs,
          ...(ctx.institutionId && { institutionId: ctx.institutionId }),
          ...(ctx.personId && { personIdHash: hashPersonId(ctx.personId) }),
        });
        return success(result);
      } catch (err) {
        const durationMs = Date.now() - start;

        if (err instanceof ZodError) {
          logger.warn({
            requestId,
            route,
            method: req.method,
            status: 400,
            durationMs,
            error: 'validation',
          });
          return error('VALIDATION_ERROR', 'Invalid request body', 400, err.flatten().fieldErrors);
        }

        if (isAPIError(err)) {
          logger.warn({
            requestId,
            route,
            method: req.method,
            status: err.status,
            durationMs,
            code: err.code,
          });
          return error(err.code, err.message, err.status, err.details);
        }

        // Unknown error → INTERNAL, log to Sentry
        Sentry.captureException(err);
        logger.error({
          requestId,
          route,
          method: req.method,
          status: 500,
          durationMs,
          error: String(err),
        });
        return error('INTERNAL', 'An unexpected error occurred', 500);
      }
    };
  };
}
