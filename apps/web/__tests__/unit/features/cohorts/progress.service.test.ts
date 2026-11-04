/** @jest-environment node */
/**
 * El componente en curso de una matrícula (1/11): `/personas` y la ficha.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn() }));

import { currentModuleOf } from '@/features/cohorts/server/progress.service';

const mod = (position: number) => ({
  id: `m${position}`,
  name: `Componente ${position}`,
  position,
});
const assignments = [
  { id: 'a1', module: mod(1) },
  { id: 'a2', module: mod(1) },
  { id: 'b1', module: mod(2) },
  { id: 'c1', module: mod(3) },
];

describe('currentModuleOf', () => {
  it('is the first component with a lesson left', () => {
    expect(currentModuleOf(assignments, new Set(['a1']), null)).toEqual({
      name: 'Componente 1',
      index: 1,
      total: 3,
      done: false,
    });
    expect(currentModuleOf(assignments, new Set(['a1', 'a2']), null)).toMatchObject({
      name: 'Componente 2',
      index: 2,
    });
  });

  it('counts from the entry component', () => {
    expect(currentModuleOf(assignments, new Set(), 2)).toEqual({
      name: 'Componente 2',
      index: 1,
      total: 2,
      done: false,
    });
  });

  it('marks the last one as done when everything is completed, and is null without lessons', () => {
    expect(currentModuleOf(assignments, new Set(['a1', 'a2', 'b1', 'c1']), null)).toEqual({
      name: 'Componente 3',
      index: 3,
      total: 3,
      done: true,
    });
    expect(currentModuleOf([], new Set(), null)).toBeNull();
  });
});
