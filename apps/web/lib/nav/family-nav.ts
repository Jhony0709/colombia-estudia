/**
 * Los destinos del acudiente (Fase C, 23/9). Puro, como `student-nav.ts`.
 * SSOT: reference/01-routing/routes.md (`/familia`).
 *
 * «Mis programas» aparece si además tiene `lesson.read`: quien estudia y es acudiente ve
 * las dos cosas desde la misma barra, y en el área del estudiante «Mi familia» está en el
 * menú de la persona (`student-nav.ts`).
 */

import type { Capability } from '@colombia-estudia/domain';
import type { NavDestination } from './staff-nav';

interface FamilyDefinition extends NavDestination {
  needs: Capability | null;
}

const NAV: readonly FamilyDefinition[] = [
  {
    href: '/familia',
    label: 'Mi familia',
    needs: null,
    section: 'familia',
    activeUnder: ['/familia/'],
  },
  { href: '/aprender', label: 'Mis programas', needs: 'lesson.read', section: 'estudiar' },
];

export function buildFamilyNav(
  capabilities: ReadonlyMap<Capability, readonly unknown[]>
): NavDestination[] {
  return NAV.filter((d) => d.needs === null || (capabilities.get(d.needs)?.length ?? 0) > 0).map(
    ({ href, label, section, activeUnder }) => ({ href, label, section, activeUnder })
  );
}
