/** @jest-environment node */
/** La opinión al terminar un componente (11/10). SSOT: features/feedback/server/feedback.service.ts. */

const db = {
  enrollment: { findFirst: jest.fn() },
  module: { findFirst: jest.fn() },
  moduleFeedback: { findFirst: jest.fn(), create: jest.fn() },
  person: { findFirst: jest.fn() },
};
const mockNotifyMany = jest.fn();
const mockGetCohortOutline = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
  staffPersonIds: jest.fn(async () => ['staff-1']),
}));
jest.mock('@/features/learn/server/cohort.service', () => ({
  getCohortOutline: (...args: unknown[]) => mockGetCohortOutline(...args),
}));

import {
  lowestScore,
  moduleDone,
  submitModuleFeedback,
  summarizeFeedback,
} from '@/features/feedback/server/feedback.service';

const NOW = new Date('2026-10-11T15:00:00.000Z');
const INPUT = {
  usefulness: 5,
  understanding: 4,
  clarity: 4,
  support: null,
  comment: '  Más videos  ',
};
const ARGS = {
  institutionId: 'inst-1',
  personId: 'p-1',
  enrollmentId: 'e-1',
  moduleId: 'm-1',
  now: NOW,
};

const done = [{ status: 'COMPLETED' }, { status: 'COMPLETED' }];

beforeEach(() => {
  jest.clearAllMocks();
  db.enrollment.findFirst.mockResolvedValue({
    id: 'e-1',
    status: 'ACTIVE',
    startsAtModule: 1,
    cohort: { id: 'c-1', programId: 'prog-1', program: { name: 'Bachillerato' } },
  });
  db.module.findFirst.mockResolvedValue({ id: 'm-1', name: 'Fundamentos', position: 1 });
  db.moduleFeedback.findFirst.mockResolvedValue(null);
  db.moduleFeedback.create.mockResolvedValue({ id: 'f-1', createdAt: NOW });
  db.person.findFirst.mockResolvedValue({ givenName: 'Ana', familyName: 'Ruiz' });
  mockGetCohortOutline.mockResolvedValue({
    gate: null,
    modules: [
      { id: 'm-1', name: 'Fundamentos', position: 1, access: { state: 'OPEN' }, items: done },
      { id: 'm-2', name: 'Ciencias', position: 2, access: { state: 'LOCKED' }, items: [] },
    ],
  });
});

describe('moduleDone y lowestScore', () => {
  it('un componente sin ítems no está terminado', () => {
    expect(moduleDone([])).toBe(false);
    expect(moduleDone([{ status: 'COMPLETED' }, { status: 'IN_PROGRESS' }])).toBe(false);
    expect(moduleDone(done)).toBe(true);
  });

  it('la atención que no se necesitó no cuenta', () => {
    expect(lowestScore({ usefulness: 4, understanding: 5, clarity: 3, support: null })).toBe(3);
    expect(lowestScore({ usefulness: 4, understanding: 5, clarity: 3, support: 1 })).toBe(1);
  });
});

describe('submitModuleFeedback', () => {
  it('guarda con el comentario recortado y no avisa si todo es alto', async () => {
    const result = await submitModuleFeedback({ ...ARGS, input: INPUT });
    expect(result).toEqual({ createdAt: NOW.toISOString(), already: false });
    expect(db.moduleFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          comment: 'Más videos',
          support: null,
          enrollmentId: 'e-1',
        }),
      })
    );
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });

  it('una nota de 2 o menos avisa a operación, una sola vez por respuesta', async () => {
    await submitModuleFeedback({ ...ARGS, input: { ...INPUT, understanding: 2 } });
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['staff-1'],
      expect.objectContaining({
        type: 'feedback_low',
        href: '/cohortes/c-1/opiniones',
        dedupeKey: 'module_feedback:f-1',
      })
    );
  });

  it('si ya respondió, devuelve la anterior y no guarda otra', async () => {
    db.moduleFeedback.findFirst.mockResolvedValue({ createdAt: NOW });
    const result = await submitModuleFeedback({ ...ARGS, input: INPUT });
    expect(result.already).toBe(true);
    expect(db.moduleFeedback.create).not.toHaveBeenCalled();
  });

  it('no se opina de un componente sin terminar', async () => {
    mockGetCohortOutline.mockResolvedValue({
      gate: null,
      modules: [
        {
          id: 'm-1',
          name: 'Fundamentos',
          position: 1,
          access: { state: 'OPEN' },
          items: [{ status: 'IN_PROGRESS' }],
        },
      ],
    });
    await expect(submitModuleFeedback({ ...ARGS, input: INPUT })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('una matrícula ajena es NOT_FOUND', async () => {
    db.enrollment.findFirst.mockResolvedValue(null);
    await expect(submitModuleFeedback({ ...ARGS, input: INPUT })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('dos envíos a la vez: el segundo devuelve el primero', async () => {
    db.moduleFeedback.create.mockRejectedValue({ unique: true });
    db.moduleFeedback.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ createdAt: NOW });
    const result = await submitModuleFeedback({ ...ARGS, input: INPUT });
    expect(result.already).toBe(true);
  });
});

describe('summarizeFeedback', () => {
  const modules = [
    { id: 'm-1', position: 1, name: 'Fundamentos' },
    { id: 'm-2', position: 2, name: 'Ciencias' },
  ];
  const row = (
    id: string,
    scores: [number, number, number, number | null],
    comment: string | null
  ) => ({
    id,
    moduleId: 'm-1',
    enrollmentId: `e-${id}`,
    personName: `Persona ${id}`,
    usefulness: scores[0],
    understanding: scores[1],
    clarity: scores[2],
    support: scores[3],
    comment,
    createdAt: new Date(`2026-10-1${id}T12:00:00.000Z`),
  });

  it('promedia por pregunta, ignora la atención no necesitada y lista lo que dice algo', () => {
    const [first, second] = summarizeFeedback(modules, [
      row('1', [5, 4, 4, null], null),
      row('2', [3, 2, 4, 5], null),
      row('3', [4, 5, 5, 4], 'Más ejemplos'),
    ]);
    expect(first?.responses).toBe(3);
    expect(first?.averages).toEqual({
      usefulness: 4,
      understanding: 3.7,
      clarity: 4.3,
      support: 4.5,
    });
    expect(first?.low).toBe(1);
    expect(first?.entries.map((e) => e.id)).toEqual(['3', '2']);
    expect(second).toMatchObject({ responses: 0, averages: { usefulness: null }, entries: [] });
  });
});
