/**
 * Los destinos del estudiante, filtrados por capacidad. Puro, como `staff-nav.ts`.
 * SSOT: reference/01-routing/routes.md:31-38.
 *
 * «Mi cuenta» (`/aprender/mi-cuenta`) solo con `billing.read.own`: el estudiante adulto que
 * paga o el acudiente; un plan que paga un aliado no la da (decisión 8).
 */

import type { Capability } from '@colombia-estudia/domain';
import type { NavDestination } from './staff-nav';

interface StudentDefinition extends NavDestination {
  needs: Capability;
}

/**
 * `section` decide dónde cae cada destino en la barra superior (21/9): `estudiar` son las
 * pestañas; `historial` va en el menú de la persona.
 */
const NAV: readonly StudentDefinition[] = [
  {
    href: '/aprender',
    label: 'Mis programas',
    needs: 'lesson.read',
    section: 'estudiar',
    // El player y los exámenes son «Mis programas»; los otros destinos tienen su prefijo.
    activeUnder: ['/aprender/tema/', '/aprender/examen/'],
  },
  { href: '/aprender/calendario', label: 'Calendario', needs: 'lesson.read', section: 'estudiar' },
  { href: '/aprender/biblioteca', label: 'Biblioteca', needs: 'lesson.read', section: 'estudiar' },
  {
    href: '/aprender/resultados',
    label: 'Resultados',
    needs: 'score.read.own',
    section: 'historial',
  },
  {
    href: '/aprender/certificados',
    label: 'Constancias',
    needs: 'score.read.own',
    section: 'historial',
  },
  {
    href: '/aprender/mi-cuenta',
    label: 'Mi cuenta',
    needs: 'billing.read.own',
    section: 'historial',
  },
  // El estudiante que además es acudiente (Fase C, 23/9): su otra área, en el menú.
  {
    href: '/familia',
    label: 'Mi familia',
    needs: 'progress.read.ward',
    section: 'historial',
  },
];

export function buildStudentNav(
  capabilities: ReadonlyMap<Capability, readonly unknown[]>
): NavDestination[] {
  return NAV.filter((d) => (capabilities.get(d.needs)?.length ?? 0) > 0).map(
    ({ href, label, section, activeUnder }) => ({ href, label, section, activeUnder })
  );
}
