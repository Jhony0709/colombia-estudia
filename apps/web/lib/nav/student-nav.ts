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

/** Los grupos de la barra lateral del estudiante (20/9), en el orden en que se pintan. */
export const STUDENT_SECTIONS = [
  { key: 'estudiar', label: 'Estudiar' },
  { key: 'historial', label: 'Mi historial' },
] as const;

const NAV: readonly StudentDefinition[] = [
  {
    href: '/aprender',
    label: 'Mi programa',
    needs: 'lesson.read',
    section: 'estudiar',
    // El player y las evaluaciones son «Mi programa»; los otros destinos tienen su prefijo.
    activeUnder: ['/aprender/tema/', '/aprender/evaluacion/'],
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
];

export function buildStudentNav(
  capabilities: ReadonlyMap<Capability, readonly unknown[]>
): NavDestination[] {
  return NAV.filter((d) => (capabilities.get(d.needs)?.length ?? 0) > 0).map(
    ({ href, label, section, activeUnder }) => ({ href, label, section, activeUnder })
  );
}
