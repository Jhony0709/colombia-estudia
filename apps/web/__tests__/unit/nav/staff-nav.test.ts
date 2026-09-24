/** @jest-environment node */
/**
 * Tests for the staff navigation.
 * SSOT: docs/estado.md §UI
 */

import type { Capability, Scope } from '@colombia-estudia/domain';
import { buildStaffNav } from '@/lib/nav/staff-nav';

const caps = (...list: Capability[]): Map<Capability, Scope[]> =>
  new Map(list.map((c) => [c, [{ institution: true } as Scope]]));

describe('buildStaffNav', () => {
  // El orden es el de creación de un curso (19/9): asignatura y programa antes que tema,
  // contenido antes que cohorte, cohorte antes que matrículas.
  it('gives an ADMIN every destination, in the order a course is built', () => {
    expect(
      buildStaffNav(
        caps('people.manage', 'cohort.manage', 'lesson.author', 'institution.manage')
      ).map((i) => i.href)
    ).toEqual([
      '/inicio',
      '/contenido/asignaturas',
      '/contenido/programas',
      '/contenido/temas',
      '/contenido/examenes',
      '/cohortes',
      '/personas',
      '/admin/institucion',
      '/admin/politicas',
    ]);
  });

  // Un INSTRUCTOR tiene lesson.author y ninguna de las de operaciones: escribe temas y
  // evaluaciones, pero programas y asignaturas siguen pidiendo institution.manage.
  it('a un INSTRUCTOR le enseña lo que escribe, no la forma del programa', () => {
    expect(buildStaffNav(caps('lesson.author', 'lesson.read')).map((i) => i.href)).toEqual([
      '/inicio',
      '/contenido/temas',
      '/contenido/examenes',
    ]);
  });

  it('hides the institution link from OPERATIONS', () => {
    expect(
      buildStaffNav(caps('people.manage', 'cohort.manage', 'billing.manage')).map((i) => i.href)
    ).toEqual(['/inicio', '/cohortes', '/personas', '/cartera']);
  });

  // INCLUSION_COORDINATOR solo tiene accommodation.manage: ve el reporte de inclusión y nada más (19/9).
  it('a coordinación de inclusión le enseña solo su reporte', () => {
    expect(buildStaffNav(caps('accommodation.manage')).map((i) => i.href)).toEqual([
      '/inicio',
      '/admin/inclusion/reporte',
    ]);
  });

  it('returns nothing for someone with no staff capabilities', () => {
    expect(buildStaffNav(caps('lesson.read'))).toEqual([]);
    expect(buildStaffNav(new Map())).toEqual([]);
  });

  it('treats a capability with no scopes as absent', () => {
    expect(buildStaffNav(new Map([['people.manage', []]]))).toEqual([]);
  });
});
