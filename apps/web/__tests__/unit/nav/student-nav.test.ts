/** @jest-environment node */
/**
 * Tests for the student navigation.
 * SSOT: reference/01-routing/routes.md:31-38
 */

import type { Capability, Scope } from '@colombia-estudia/domain';
import { buildStudentNav } from '@/lib/nav/student-nav';

const caps = (...list: Capability[]): Map<Capability, Scope[]> =>
  new Map(list.map((c) => [c, [{ own: true } as unknown as Scope]]));

const student = caps('lesson.read', 'score.read.own');

describe('buildStudentNav', () => {
  it('shows «Resultados» once there is something to see', () => {
    expect(buildStudentNav(student, { hasResults: true }).map((i) => i.href)).toEqual([
      '/aprender',
      '/aprender/calendario',
      '/aprender/resultados',
      '/aprender/biblioteca',
      '/aprender/certificados',
    ]);
  });

  // El primer día (6/10): una pestaña vacía más no ayuda; las constancias siguen en el menú.
  it('hides «Resultados» before the first result', () => {
    const hrefs = buildStudentNav(student, { hasResults: false }).map((i) => i.href);
    expect(hrefs).not.toContain('/aprender/resultados');
    expect(hrefs).toContain('/aprender/certificados');
  });

  it('keeps the previous behaviour when the caller does not say', () => {
    expect(buildStudentNav(student).map((i) => i.href)).toContain('/aprender/resultados');
  });
});
