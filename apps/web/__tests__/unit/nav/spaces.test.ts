/** @jest-environment node */
/**
 * Los espacios de una persona (ola 3, 23/9): se listan por lo que puede hacer, no por el rol.
 */

import type { Capability, Scope } from '@colombia-estudia/domain';
import { buildSpaces, spaceOf } from '@/lib/nav/spaces';

const caps = (entries: Array<[Capability, Scope[]]>): Map<Capability, Scope[]> => new Map(entries);
const inst: Scope = { institution: true };

describe('buildSpaces', () => {
  it('un estudiante que solo estudia tiene un espacio', () => {
    expect(buildSpaces(caps([['lesson.read', [inst]]])).map((s) => s.key)).toEqual(['learn']);
  });

  it('quien opera y además estudia tiene los dos, gestión primero', () => {
    const spaces = buildSpaces(
      caps([
        ['cohort.manage', [inst]],
        ['lesson.read', [inst]],
      ])
    );
    expect(spaces.map((s) => s.key)).toEqual(['staff', 'learn']);
    expect(spaces[0]?.href).toBe('/inicio');
  });

  it('el acudiente que también estudia ve Aprender y Mi familia', () => {
    expect(
      buildSpaces(
        caps([
          ['lesson.read', [inst]],
          ['progress.read.ward', [{ enrollmentId: 'e1' }]],
        ])
      ).map((s) => s.key)
    ).toEqual(['learn', 'family']);
  });

  it('el aliado se reconoce por el alcance partnerId, no por leer avance de cohorte', () => {
    expect(
      buildSpaces(caps([['progress.read.cohort', [{ cohortId: 'c1' }]]])).map((s) => s.key)
    ).toEqual([]);
    expect(
      buildSpaces(caps([['progress.read.cohort', [{ partnerId: 'p1' }]]])).map((s) => s.key)
    ).toEqual(['partner']);
  });

  it('una capacidad sin alcances no abre ningún espacio', () => {
    expect(buildSpaces(caps([['lesson.read', []]]))).toEqual([]);
  });
});

describe('spaceOf', () => {
  const spaces = buildSpaces(
    caps([
      ['cohort.manage', [inst]],
      ['lesson.read', [inst]],
    ])
  );

  it('reconoce el espacio por el prefijo de la ruta', () => {
    expect(spaceOf(spaces, '/cohortes/abc?seccion=ruta'.split('?')[0]!)?.key).toBe('staff');
    expect(spaceOf(spaces, '/aprender/tema/x')?.key).toBe('learn');
    expect(spaceOf(spaces, '/inicio')?.key).toBe('staff');
  });

  it('no confunde un prefijo con una palabra que empieza igual', () => {
    expect(spaceOf(spaces, '/aprenderx')).toBeNull();
    expect(spaceOf(spaces, '/')).toBeNull();
    expect(spaceOf(spaces, null)).toBeNull();
  });
});
