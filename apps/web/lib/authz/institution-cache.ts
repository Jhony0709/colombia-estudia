/**
 * LRU cache for institution resolution.
 * SSOT: plan/03-identidad-y-acceso.md "Middleware" note
 *
 * "getRequestContext() (Node, React.cache por request + LRU en memoria con TTL 5 min)"
 *
 * Keyed by slug while the tenant is hardcoded (lib/authz/tenant.ts); by host later.
 * No external dependencies - uses a Map with timestamps.
 */

import { prisma } from '../db/prisma';

// ─────────────────────────── Types ───────────────────────────

interface CachedInstitution {
  id: string;
  slug: string;
  name: string;
  supportEmail: string;
  supportPhone: string | null;
  emailFromName: string;
  dataPolicyVersion: string;
  settings: unknown;
}

interface CacheEntry {
  institution: CachedInstitution;
  cachedAt: number;
}

// ─────────────────────────── Cache Configuration ───────────────────────────

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 100; // Max institutions to cache (unlikely to have more tenants)

// ─────────────────────────── Cache Storage ───────────────────────────

const cache = new Map<string, CacheEntry>();

// ─────────────────────────── Cache Operations ───────────────────────────

/**
 * Evict expired entries and enforce max size.
 */
function evict(now: number): void {
  // Evict expired
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > TTL_MS) {
      cache.delete(key);
    }
  }

  // If still over max, evict oldest
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

/**
 * Resolve an institution by its slug.
 *
 * @returns The institution or null if not found
 */
export async function resolveInstitutionBySlug(slug: string): Promise<CachedInstitution | null> {
  const now = Date.now();

  // Check cache
  const cached = cache.get(slug);
  if (cached && now - cached.cachedAt <= TTL_MS) {
    return cached.institution;
  }

  // Evict stale entries before adding new one
  evict(now);

  // Query database - NOT using tenant client (this is pre-tenant resolution)
  const institution = await prisma.institution.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      supportEmail: true,
      supportPhone: true,
      emailFromName: true,
      dataPolicyVersion: true,
      settings: true,
    },
  });

  if (!institution) {
    // Don't cache misses
    return null;
  }

  // Cache the result
  cache.set(slug, {
    institution,
    cachedAt: now,
  });

  return institution;
}

/**
 * Clear the cache. For testing only.
 */
export function clearInstitutionCache(): void {
  cache.clear();
}

/**
 * Get cache size. For testing only.
 */
export function getInstitutionCacheSize(): number {
  return cache.size;
}

export type { CachedInstitution };
