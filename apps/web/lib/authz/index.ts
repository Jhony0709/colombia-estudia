/**
 * Authorization module exports.
 * SSOT: plan/03-identidad-y-acceso.md
 */

export { isProtected, isValidNextUrl, sanitizeNextUrl } from './routes';
export { COLOMBIA_ESTUDIA } from './tenant';
export {
  resolveInstitutionBySlug,
  clearInstitutionCache,
  getInstitutionCacheSize,
  type CachedInstitution,
} from './institution-cache';
export {
  getRequestContext,
  MFA_REQUIRED_ROLES,
  STAFF_ROLES,
  type RequestContext,
  type ResolvedPerson,
} from './request-context';
export { requireStaffSession } from './staff';
export {
  withCapability,
  requireCapability,
  type WithCapabilityOptions,
  type CapabilityHandler,
} from './with-capability';
