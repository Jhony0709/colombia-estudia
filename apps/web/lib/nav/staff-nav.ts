/**
 * What the staff header shows, decided by what the person can actually do.
 * SSOT: plan/11-ux.md, packages/domain/src/capabilities.ts.
 *
 * Pure so it can be tested without a request: the rule "a door you cannot open should not be
 * on the wall" is worth a test, not a hope.
 */

import type { Capability, Scope } from '@colombia-estudia/domain';

/**
 * Un destino de la navegación de staff. **Es un dato, no un componente**: el componente que
 * lo pinta se llama `NavItem` (`components/atoms/nav-item`), y compartir nombre con él hacía
 * que un archivo no pudiera usar los dos.
 */
export interface NavDestination {
  href: string;
  label: string;
  /**
   * El rótulo del grupo en la barra lateral.
   *
   * Opcional en el tipo porque `AppHeader` —retirado— no agrupa y sus fixtures no lo traen;
   * `buildStaffNav` siempre lo rellena, así que en la aplicación nunca falta.
   */
  section?: string;
  /**
   * Prefijos bajo los que el destino cuenta como activo, además de `href` exacto. Sin esto,
   * activo = `href` o `href/…`. Lo usa «Mi programa» (`/aprender`), que también es el player
   * (`/aprender/tema/…`) pero no el calendario (`/aprender/calendario`).
   */
  activeUnder?: readonly string[];
}

interface NavDefinition extends NavDestination {
  /** La capacidad que abre la puerta; `'staff'` = cualquiera de las de staff. */
  capability: Capability | 'staff';
}

/**
 * Las capacidades que hacen a alguien «staff» a efectos de la barra: con cualquiera de
 * ellas, `/inicio` tiene algo que decirle (entregas, cohortes, invitaciones, cartera).
 */
const STAFF_CAPABILITIES: readonly Capability[] = [
  'institution.manage',
  'cohort.manage',
  'people.manage',
  'billing.manage',
  'lesson.author',
  'assessment.grade',
  'accommodation.manage',
];

/**
 * El orden de la pantalla es **el orden en que se crea un curso** (Jhonny, 19/9), que es el
 * que impone el modelo: una asignatura y un programa antes que un tema (`Lesson.subjectId` y
 * `moduleId` son obligatorios), los temas y evaluaciones publicados antes de abrir una
 * cohorte (`openCohort` falla si falta alguna versión publicada), y la cohorte antes que las
 * matrículas. Leer la barra de arriba abajo enseña el modelo sin abrir la ayuda.
 *
 * Hasta el 19/9 el orden era «el trabajo diario primero»: Personas y Cohortes arriba. Se
 * cambia porque con siete destinos visibles a la vez, bajar dos grupos no cuesta nada,
 * mientras que no entender por qué una cohorte no abre cuesta una tarde.
 */
const NAV: readonly NavDefinition[] = [
  // Ola 3 (23/9): la pantalla de situación, arriba del todo y para todo el staff.
  { href: '/inicio', label: 'Inicio', capability: 'staff', section: 'inicio' },
  {
    href: '/contenido/asignaturas',
    label: 'Asignaturas',
    capability: 'institution.manage',
    section: 'plan',
  },
  {
    href: '/contenido/programas',
    label: 'Programas',
    capability: 'institution.manage',
    section: 'plan',
  },
  { href: '/contenido/temas', label: 'Temas', capability: 'lesson.author', section: 'contenido' },
  {
    href: '/contenido/examenes',
    label: 'Exámenes',
    capability: 'lesson.author',
    section: 'contenido',
  },
  { href: '/cohortes', label: 'Cohortes', capability: 'cohort.manage', section: 'operacion' },
  { href: '/personas', label: 'Personas', capability: 'people.manage', section: 'operacion' },
  { href: '/cartera', label: 'Cartera', capability: 'billing.manage', section: 'operacion' },
  {
    href: '/admin/inclusion/reporte',
    label: 'Inclusión',
    capability: 'accommodation.manage',
    section: 'operacion',
  },
  {
    href: '/admin/institucion',
    label: 'Institución',
    capability: 'institution.manage',
    section: 'administracion',
  },
  {
    href: '/admin/politicas',
    label: 'Políticas',
    capability: 'institution.manage',
    section: 'administracion',
  },
];

const has = (capabilities: Map<Capability, Scope[]>, capability: Capability) =>
  (capabilities.get(capability)?.length ?? 0) > 0;

export function buildStaffNav(capabilities: Map<Capability, Scope[]>): NavDestination[] {
  return NAV.filter((item) =>
    item.capability === 'staff'
      ? STAFF_CAPABILITIES.some((c) => has(capabilities, c))
      : has(capabilities, item.capability)
  ).map(({ href, label, section }) => ({ href, label, section }));
}
