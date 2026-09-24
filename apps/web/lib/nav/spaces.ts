/**
 * Los espacios de una persona (ola 3 UX, 23/9): las áreas de la aplicación a las que puede
 * entrar con lo que tiene. Puro, como `staff-nav.ts`, y con la misma regla: un espacio se
 * lista si la persona puede hacer algo en él, no por el rol que tenga escrito.
 * SSOT: docs/ux/decision-ux-2309.md («Shell — selector de espacios en la marca, solo
 * multi-rol»), reference/01-routing/routes.md.
 *
 * El conmutador (`components/molecules/space-switcher`) solo se pinta con dos o más: quien
 * tiene un espacio no necesita elegirlo.
 */

import type { Capability } from '@colombia-estudia/domain';

export type SpaceKey = 'staff' | 'learn' | 'family' | 'partner';

export interface Space {
  key: SpaceKey;
  href: string;
  label: string;
  /** Prefijos de ruta que pertenecen al espacio, para marcar el actual. */
  prefixes: readonly string[];
}

const STAFF_CAPABILITIES: readonly Capability[] = [
  'institution.manage',
  'cohort.manage',
  'people.manage',
  'billing.manage',
  'lesson.author',
  'assessment.grade',
  'accommodation.manage',
];

const SPACES: ReadonlyArray<Omit<Space, 'label'> & { label: string }> = [
  {
    key: 'staff',
    href: '/inicio',
    label: 'Gestión',
    prefixes: [
      '/inicio',
      '/contenido',
      '/cohortes',
      '/personas',
      '/cartera',
      '/admin',
      '/notificaciones',
    ],
  },
  { key: 'learn', href: '/aprender', label: 'Aprender', prefixes: ['/aprender'] },
  { key: 'family', href: '/familia', label: 'Mi familia', prefixes: ['/familia'] },
  { key: 'partner', href: '/aliado', label: 'Aliado', prefixes: ['/aliado'] },
];

type Scopes = ReadonlyMap<Capability, ReadonlyArray<Record<string, unknown>>>;

const has = (capabilities: Scopes, c: Capability) => (capabilities.get(c)?.length ?? 0) > 0;

export function buildSpaces(capabilities: Scopes): Space[] {
  const allowed: Record<SpaceKey, boolean> = {
    staff: STAFF_CAPABILITIES.some((c) => has(capabilities, c)),
    learn: has(capabilities, 'lesson.read'),
    family: has(capabilities, 'progress.read.ward'),
    // El contacto del aliado ve el avance de sus cohortes con alcance `partnerId`.
    partner: (capabilities.get('progress.read.cohort') ?? []).some((s) => 'partnerId' in s),
  };
  return SPACES.filter((space) => allowed[space.key]).map((space) => ({ ...space }));
}

/** El espacio al que pertenece una ruta, o `null` si no es de ninguno (portada, auth). */
export function spaceOf(spaces: readonly Space[], path: string | null): Space | null {
  if (!path) return null;
  return (
    spaces.find((space) =>
      space.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    ) ?? null
  );
}
