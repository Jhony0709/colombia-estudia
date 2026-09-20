/**
 * Capability checking wrapper for route handlers.
 * SSOT: plan/03-identidad-y-acceso.md "withCapability"
 *
 * Verifies the user has the required capability with appropriate scope.
 */

import { redirect } from 'next/navigation';
import { HOME_AFTER_LOGIN } from './routes';
import { APIError } from '../core/errors';
import { getRequestContext, type RequestContext } from './request-context';
import { scopeAllows, type Capability, type ResourceScope } from '@colombia-estudia/domain';

// ─────────────────────────── Types ───────────────────────────

/**
 * Options for loading and checking a resource.
 */
export interface WithCapabilityOptions<TResource> {
  /**
   * Load the resource by ID from params.
   * Return null if not found (will result in 404).
   */
  load: (
    ctx: RequestContext,
    params: Record<string, string | string[] | undefined>
  ) => Promise<TResource | null>;

  /**
   * Extract the scope from the loaded resource.
   * Used to verify the user's capability scope covers this resource.
   */
  scopeOf: (resource: TResource) => ResourceScope;
}

/**
 * Handler function signature for capability-checked handlers.
 */
export type CapabilityHandler<TResource, TResult> = (
  ctx: RequestContext,
  resource: TResource,
  request: Request
) => Promise<TResult>;

// ─────────────────────────── withCapability ───────────────────────────

/**
 * Create a handler wrapper that checks for a capability.
 *
 * Usage:
 * ```ts
 * export const GET = withCapability('lesson.read', {
 *   load: async (ctx, params) => db.lesson.findUnique({ where: { id: params.id } }),
 *   scopeOf: (lesson) => ({ cohortId: lesson.cohortId }),
 * })(async (ctx, lesson, req) => {
 *   return { lesson };
 * });
 * ```
 *
 * Or without resource:
 * ```ts
 * export const GET = withCapability('institution.manage')(async (ctx, _, req) => {
 *   return { settings: ctx.institution.settings };
 * });
 * ```
 *
 * @param capability - The capability required
 * @param opts - Optional resource loading and scope checking
 */
export function withCapability<TResource = undefined>(
  capability: Capability,
  opts?: TResource extends undefined ? undefined : WithCapabilityOptions<TResource>
) {
  return <TResult>(handler: CapabilityHandler<TResource, TResult>) => {
    return async (
      request: Request,
      routeContext?: { params?: Promise<Record<string, string | string[] | undefined>> }
    ): Promise<TResult> => {
      const ctx = await getRequestContext();
      const params = routeContext?.params ? await routeContext.params : {};

      // Check authentication
      if (!ctx.person) {
        throw new APIError('Authentication required', 'UNAUTHENTICATED');
      }

      // Check capability exists
      const scopes = ctx.capabilities.get(capability);
      if (!scopes || scopes.length === 0) {
        throw new APIError(`Missing capability: ${capability}`, 'INSUFFICIENT_CAPABILITY');
      }

      // If no resource to check, capability alone is sufficient
      if (!opts) {
        return handler(ctx, undefined as TResource, request);
      }

      // Load the resource
      const resource = await opts.load(ctx, params);

      // Resource not found → 404 (never reveal if it exists in another institution)
      // SSOT: errors.md:14 "No existe O no es de esta institución (no se distingue)"
      if (!resource) {
        throw new APIError('Resource not found', 'NOT_FOUND');
      }

      // Check scope
      const resourceScope = opts.scopeOf(resource);
      if (!scopeAllows(scopes, resourceScope)) {
        // Same institution, different scope (e.g., other cohort) → 403
        throw new APIError(
          `Resource out of scope for capability: ${capability}`,
          'INSUFFICIENT_CAPABILITY'
        );
      }

      return handler(ctx, resource, request);
    };
  };
}

// ─────────────────────────── requireCapability ───────────────────────────

/**
 * Check a capability in a layout and redirect to "/" if missing.
 *
 * Use this in layouts to guard areas. Unlike withCapability (which throws 401/403),
 * this redirects because it's for page navigation, not API errors.
 *
 * Usage:
 * ```tsx
 * export default async function AdminLayout({ children }) {
 *   await requireCapability('institution.manage');
 *   return <>{children}</>;
 * }
 * ```
 *
 * @param capability - The capability required
 * @throws Redirects to "/" if capability is missing
 */
export async function requireCapability(capability: Capability): Promise<void> {
  const ctx = await getRequestContext();

  // No person → redirect to login (middleware should catch this, but safety net)
  if (!ctx.person) {
    redirect('/auth/login');
  }

  // No capability → al área del rol (routes.md:20). `/ingresar` decide cuál; nunca vuelve
  // aquí porque cada área pide una capacidad que su rol sí tiene.
  const scopes = ctx.capabilities.get(capability);
  if (!scopes || scopes.length === 0) {
    redirect(HOME_AFTER_LOGIN);
  }
}
