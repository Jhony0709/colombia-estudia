/**
 * Los destinos del estudiante, filtrados por capacidad. Puro, como `staff-nav.ts`.
 * SSOT: reference/01-routing/routes.md:31-38.
 *
 * «Mi cuenta» (`/aprender/mi-cuenta`) solo con `billing.read.own`: el estudiante adulto que
 * paga o el acudiente; un plan que paga un aliado no la da (decisión 8).
 *
 * «Resultados» aparece con el primer resultado (6/10): antes era una pestaña vacía.
 */

import type { Capability } from '@colombia-estudia/domain';
import type { NavDestination } from './staff-nav';

interface StudentDefinition extends NavDestination {
  needs: Capability;
  /** Solo cuando ya hay algo que ver. */
  needsResults?: true;
}

/**
 * `section` decide dónde cae cada destino en la barra superior (21/9): `estudiar` son las
 * pestañas; `historial` va en el menú de la persona.
 */
const NAV: readonly StudentDefinition[] = [
  {
    href: '/aprender',
    // «Inicio» (4/10): desde que `/aprender` es el panel —lo que toca, cómo vas, qué viene—
    // dejó de ser una lista de programas.
    label: 'Inicio',
    needs: 'lesson.read',
    section: 'estudiar',
    // El player, los exámenes y las páginas de curso cuelgan de Inicio; los otros, su prefijo.
    activeUnder: [
      '/aprender/tema/',
      '/aprender/examen/',
      '/aprender/curso/',
      '/aprender/catalogo/',
    ],
  },
  { href: '/aprender/calendario', label: 'Calendario', needs: 'lesson.read', section: 'estudiar' },
  // Resultados sube a pestaña (4/10): «¿cómo me fue?» es de las tres preguntas del estudiante y
  // vivía detrás del menú de la persona.
  {
    href: '/aprender/resultados',
    label: 'Resultados',
    needs: 'score.read.own',
    section: 'estudiar',
    needsResults: true,
  },
  { href: '/aprender/biblioteca', label: 'Biblioteca', needs: 'lesson.read', section: 'estudiar' },
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
  capabilities: ReadonlyMap<Capability, readonly unknown[]>,
  { hasResults = true }: { hasResults?: boolean } = {}
): NavDestination[] {
  return NAV.filter(
    (d) => (capabilities.get(d.needs)?.length ?? 0) > 0 && (hasResults || !d.needsResults)
  ).map(({ href, label, section, activeUnder }) => ({ href, label, section, activeUnder }));
}
