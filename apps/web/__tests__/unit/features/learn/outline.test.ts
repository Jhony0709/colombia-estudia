/** @jest-environment node */
/**
 * La secuencia del programa: qué puede abrir un estudiante y por qué no lo otro.
 * SSOT: plan/08-aprender-y-evaluar.md:12-19, reference/01-routing/routes.md:27.
 *
 * Puro: sin base de datos y sin mocks. Es la regla que decide si alguien puede estudiar.
 */

import {
  sequence,
  moduleAccess,
  sortItems,
  resumePoint,
  nextPoint,
  progressOf,
  neighbours,
  workshopStart,
  type ModuleAccess,
  type OutlineItem,
} from '@/features/learn/server/outline';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const AYER = new Date('2026-09-17T00:00:00.000Z');
const MANANA = new Date('2026-09-19T00:00:00.000Z');

const item = (
  over: Partial<OutlineItem> & { assignmentId: string; title: string }
): OutlineItem => ({
  kind: 'LESSON',
  moduleId: 'm1',
  position: 1,
  status: 'NOT_STARTED',
  availableFrom: AYER,
  availableUntil: null,
  ...over,
});

const lineal = (modules: Array<{ id: string; items: OutlineItem[]; access?: ModuleAccess }>) =>
  sequence({ modules, progression: 'LINEAR', now: NOW });

describe('sortItems', () => {
  it('los temas van antes que los exámenes de módulo', () => {
    const mezcla = [
      item({ assignmentId: 'e1', title: 'Eval', kind: 'ASSESSMENT', position: 1 }),
      item({ assignmentId: 't2', title: 'Tema 2', position: 2 }),
      item({ assignmentId: 't1', title: 'Tema 1', position: 1 }),
    ];

    expect(sortItems(mezcla).map((i) => i.assignmentId)).toEqual(['t1', 't2', 'e1']);
  });

  it('el examen de un tema va justo después de ese tema (20/9)', () => {
    const mezcla = [
      item({ assignmentId: 'e-fin', title: 'Final', kind: 'ASSESSMENT', position: 2 }),
      item({ assignmentId: 't2', title: 'Tema 2', position: 2, lessonId: 'l2' }),
      item({
        assignmentId: 'e1',
        title: 'Examen 1',
        kind: 'ASSESSMENT',
        position: 1,
        lessonId: 'l1',
      }),
      item({ assignmentId: 't1', title: 'Tema 1', position: 1, lessonId: 'l1' }),
    ];

    expect(sortItems(mezcla).map((i) => i.assignmentId)).toEqual(['t1', 'e1', 't2', 'e-fin']);
  });

  // 3/10 (cliente): el componente se recorre taller a taller, con el cuestionario del taller
  // después de sus temas y antes del siguiente taller.
  it('agrupa por taller: temas de Lengua, su cuestionario, temas de Matemáticas, el suyo', () => {
    const lengua = { subjectId: 's-lengua', subjectName: 'Lengua castellana' };
    const mates = { subjectId: 's-mates', subjectName: 'Matemáticas' };
    const items = [
      item({
        assignmentId: 'q-mates',
        title: 'Cuestionario mates',
        kind: 'ASSESSMENT',
        position: 2,
        ...mates,
      }),
      item({
        assignmentId: 'q-lengua',
        title: 'Cuestionario lengua',
        kind: 'ASSESSMENT',
        position: 1,
        ...lengua,
      }),
      item({ assignmentId: 'm1', title: 'Naturales', position: 3, lessonId: 'lm1', ...mates }),
      item({ assignmentId: 'l2', title: 'Organizadores', position: 2, lessonId: 'll2', ...lengua }),
      item({ assignmentId: 'l1', title: 'Comunicación', position: 1, lessonId: 'll1', ...lengua }),
      item({
        assignmentId: 'q-comp',
        title: 'Final del componente',
        kind: 'ASSESSMENT',
        position: 3,
      }),
    ];

    expect(sortItems(items).map((i) => i.assignmentId)).toEqual([
      'l1',
      'l2',
      'q-lengua',
      'm1',
      'q-mates',
      'q-comp',
    ]);
  });

  it('el orden de los talleres es el de su primer tema, aunque los temas estén entreverados', () => {
    const a = { subjectId: 'a', subjectName: 'A' };
    const b = { subjectId: 'b', subjectName: 'B' };
    const items = [
      item({ assignmentId: 'b1', title: 'B1', position: 1, lessonId: 'b1', ...b }),
      item({ assignmentId: 'a1', title: 'A1', position: 2, lessonId: 'a1', ...a }),
      item({ assignmentId: 'b2', title: 'B2', position: 3, lessonId: 'b2', ...b }),
    ];

    expect(sortItems(items).map((i) => i.assignmentId)).toEqual(['b1', 'b2', 'a1']);
  });

  it('un examen cuyo tema no está en la ruta cae al final del módulo', () => {
    const mezcla = [
      item({
        assignmentId: 'e-x',
        title: 'Huérfano',
        kind: 'ASSESSMENT',
        position: 1,
        lessonId: 'no',
      }),
      item({ assignmentId: 't1', title: 'Tema 1', position: 1, lessonId: 'l1' }),
      item({ assignmentId: 't2', title: 'Tema 2', position: 2, lessonId: 'l2' }),
    ];

    expect(sortItems(mezcla).map((i) => i.assignmentId)).toEqual(['t1', 't2', 'e-x']);
  });

  it('en LINEAR el examen del tema 1 bloquea el tema 2', () => {
    const result = lineal([
      {
        id: 'm1',
        items: [
          item({ assignmentId: 't2', title: 'Tema 2', position: 2, lessonId: 'l2' }),
          item({
            assignmentId: 'e1',
            title: 'Examen 1',
            kind: 'ASSESSMENT',
            position: 1,
            lessonId: 'l1',
          }),
          item({
            assignmentId: 't1',
            title: 'Tema 1',
            position: 1,
            lessonId: 'l1',
            status: 'COMPLETED',
          }),
        ],
      },
    ]);

    expect(result.get('e1')?.enabled).toBe(true);
    expect(result.get('t2')?.enabled).toBe(false);
    expect(result.get('t2')?.blockedBy).toBe('Examen 1');
  });
});

describe('sequence, progresión LINEAR', () => {
  const tres = [
    {
      id: 'm1',
      items: [
        item({ assignmentId: 't1', title: 'Tema 1', position: 1, status: 'COMPLETED' }),
        item({ assignmentId: 't2', title: 'Tema 2', position: 2 }),
        item({ assignmentId: 't3', title: 'Tema 3', position: 3 }),
      ],
    },
  ];

  it('habilita hasta el primero sin completar, incluido', () => {
    const result = lineal(tres);

    expect(result.get('t1')?.enabled).toBe(true);
    expect(result.get('t2')?.enabled).toBe(true);
    expect(result.get('t3')?.enabled).toBe(false);
  });

  // Decir "completa el tema 3" estando en el 7 es más útil que decir "completa el 6".
  it('el bloqueador es el PRIMER incompleto, no el inmediatamente anterior', () => {
    expect(lineal(tres).get('t3')?.blockedBy).toBe('Tema 2');
  });

  // Un módulo no es una isla: el programa es una ruta y se recorre entera.
  it('la secuencia cruza los módulos', () => {
    const result = lineal([
      { id: 'm1', items: [item({ assignmentId: 'a1', title: 'A1' })] },
      { id: 'm2', items: [item({ assignmentId: 'b1', title: 'B1', moduleId: 'm2' })] },
    ]);

    expect(result.get('b1')?.enabled).toBe(false);
    expect(result.get('b1')?.blockedBy).toBe('A1');
  });
});

describe('sequence, progresión FREE', () => {
  it('nada bloquea a nada', () => {
    const result = sequence({
      modules: [
        {
          id: 'm1',
          items: [
            item({ assignmentId: 't1', title: 'Tema 1', position: 1 }),
            item({ assignmentId: 't2', title: 'Tema 2', position: 2 }),
          ],
        },
      ],
      progression: 'FREE',
      now: NOW,
    });

    expect([...result.values()].every((i) => i.enabled)).toBe(true);
    expect([...result.values()].every((i) => i.blockedBy === null)).toBe(true);
  });
});

describe('ventanas de fecha', () => {
  it('antes de abrirse no se puede entrar', () => {
    const result = sequence({
      modules: [
        { id: 'm1', items: [item({ assignmentId: 'f1', title: 'Aún no', availableFrom: MANANA })] },
      ],
      progression: 'FREE',
      now: NOW,
    });

    expect(result.get('f1')?.enabled).toBe(false);
    expect(result.get('f1')?.unavailableReason).toBe('NOT_YET');
  });

  it('pasada la fecha de cierre tampoco', () => {
    const result = sequence({
      modules: [
        { id: 'm1', items: [item({ assignmentId: 'f2', title: 'Cerrado', availableUntil: AYER })] },
      ],
      progression: 'FREE',
      now: NOW,
    });

    expect(result.get('f2')?.unavailableReason).toBe('CLOSED');
  });

  // Decir dos cosas a la vez es no decir ninguna: se dice lo accionable.
  it('bloqueado por secuencia Y por fecha: solo se menciona la secuencia', () => {
    const result = lineal([
      {
        id: 'm1',
        items: [
          item({ assignmentId: 'x1', title: 'Pendiente', position: 1 }),
          item({ assignmentId: 'x2', title: 'Futuro', position: 2, availableFrom: MANANA }),
        ],
      },
    ]);

    expect(result.get('x2')?.blockedBy).toBe('Pendiente');
    expect(result.get('x2')?.unavailableReason).toBeNull();
  });
});

describe('moduleAccess (3/10: el componente se habilita a mano)', () => {
  it('el primero de la ruta está abierto sin habilitación; el siguiente, bloqueado', () => {
    expect(moduleAccess({ first: true, unlock: null, progression: 'LINEAR', now: NOW })).toEqual({
      state: 'OPEN',
    });
    expect(moduleAccess({ first: false, unlock: null, progression: 'LINEAR', now: NOW })).toEqual({
      state: 'LOCKED',
    });
  });

  it('habilitado sin fechas: abierto', () => {
    const unlock = { availableFrom: null, availableUntil: null };
    expect(moduleAccess({ first: false, unlock, progression: 'LINEAR', now: NOW }).state).toBe(
      'OPEN'
    );
  });

  it('habilitado con ventana: programado antes, cerrado después', () => {
    expect(
      moduleAccess({
        first: false,
        unlock: { availableFrom: MANANA, availableUntil: null },
        progression: 'LINEAR',
        now: NOW,
      })
    ).toEqual({ state: 'NOT_YET', from: MANANA });
    expect(
      moduleAccess({
        first: false,
        unlock: { availableFrom: null, availableUntil: AYER },
        progression: 'LINEAR',
        now: NOW,
      })
    ).toEqual({ state: 'CLOSED', until: AYER });
  });

  it('en FREE todo está abierto, haya o no habilitación', () => {
    expect(moduleAccess({ first: false, unlock: null, progression: 'FREE', now: NOW }).state).toBe(
      'OPEN'
    );
  });
});

describe('sequence con componente bloqueado', () => {
  const modules = [
    {
      id: 'm1',
      items: [item({ assignmentId: 'a1', title: 'Tema 1', status: 'COMPLETED' })],
      access: { state: 'OPEN' as const },
    },
    {
      id: 'm2',
      items: [item({ assignmentId: 'b1', title: 'Tema 2', moduleId: 'm2' })],
      access: { state: 'LOCKED' as const },
    },
  ];

  it('con el primero completo, el tema del componente bloqueado sigue cerrado y dice por qué', () => {
    const result = lineal(modules);
    expect(result.get('b1')?.enabled).toBe(false);
    expect(result.get('b1')?.blockedBy).toBeNull();
    expect(result.get('b1')?.unavailableReason).toBe('LOCKED');
  });

  it('el motivo del componente manda sobre la secuencia', () => {
    const result = lineal([
      { ...modules[0]!, items: [item({ assignmentId: 'a1', title: 'Tema 1' })] },
      modules[1]!,
    ]);
    expect(result.get('b1')?.blockedBy).toBeNull();
    expect(result.get('b1')?.unavailableReason).toBe('LOCKED');
  });

  it('la ventana del componente se dice como la de un tema', () => {
    const result = lineal([
      modules[0]!,
      { ...modules[1]!, access: { state: 'NOT_YET' as const, from: MANANA } },
    ]);
    expect(result.get('b1')?.unavailableReason).toBe('NOT_YET');
  });

  it('sin `access` el componente cuenta como abierto (builder y tests anteriores)', () => {
    const result = lineal([modules[0]!, { id: 'm2', items: modules[1]!.items }]);
    expect(result.get('b1')?.enabled).toBe(true);
  });
});

describe('resumePoint', () => {
  const build = (items: OutlineItem[]) => [...lineal([{ id: 'm1', items }]).values()];

  it('prefiere lo que ya está empezado', () => {
    const items = build([
      item({ assignmentId: 'p1', title: 'P1', position: 1, status: 'COMPLETED' }),
      item({ assignmentId: 'p2', title: 'P2', position: 2, status: 'IN_PROGRESS' }),
    ]);

    expect(resumePoint(items)?.assignmentId).toBe('p2');
  });

  it('sin nada a medias, el siguiente habilitado', () => {
    const items = build([
      item({ assignmentId: 'q1', title: 'Q1', position: 1, status: 'COMPLETED' }),
      item({ assignmentId: 'q2', title: 'Q2', position: 2 }),
    ]);

    expect(resumePoint(items)?.assignmentId).toBe('q2');
  });

  it('con todo completado no hay a dónde volver', () => {
    const items = build([item({ assignmentId: 'z', title: 'Z', status: 'COMPLETED' })]);

    expect(resumePoint(items)).toBeNull();
  });
});

describe('progressOf', () => {
  it('cuenta completados sobre el total', () => {
    const items = [
      ...lineal([
        {
          id: 'm1',
          items: [
            item({ assignmentId: 'a', title: 'A', position: 1, status: 'COMPLETED' }),
            item({ assignmentId: 'b', title: 'B', position: 2 }),
            item({ assignmentId: 'c', title: 'C', position: 3 }),
          ],
        },
      ]).values(),
    ];

    expect(progressOf(items)).toEqual({ completed: 1, total: 3 });
  });
});

it('un programa sin módulos no revienta', () => {
  expect(sequence({ modules: [], progression: 'LINEAR', now: NOW }).size).toBe(0);
});

describe('neighbours', () => {
  const ruta = () => [
    ...lineal([
      {
        id: 'm1',
        items: [
          item({ assignmentId: 'a', title: 'A', position: 1, status: 'COMPLETED' }),
          item({ assignmentId: 'b', title: 'B', position: 2 }),
        ],
      },
      {
        id: 'm2',
        items: [item({ assignmentId: 'c', title: 'C', moduleId: 'm2', position: 1 })],
      },
    ]).values(),
  ];

  it('el anterior y el siguiente salen del orden del programa, no del módulo', () => {
    const { previous, next } = neighbours(ruta(), 'b');

    expect(previous?.assignmentId).toBe('a');
    // 'c' está en otro módulo: la ruta se recorre entera, no módulo a módulo.
    expect(next?.assignmentId).toBe('c');
  });

  it('el primero no tiene anterior y el último no tiene siguiente', () => {
    expect(neighbours(ruta(), 'a').previous).toBeNull();
    expect(neighbours(ruta(), 'c').next).toBeNull();
  });

  // El vecino se devuelve tal cual, bloqueado incluido: con progresión lineal el siguiente
  // SIEMPRE está bloqueado mientras el actual no se complete, y esconderlo dejaría la barra
  // de acciones sin nada que explicar.
  it('devuelve el siguiente aunque esté bloqueado', () => {
    const { next } = neighbours(ruta(), 'b');

    expect(next?.enabled).toBe(false);
    expect(next?.blockedBy).toBe('B');
  });

  it('un id que no está en la ruta no tiene vecinos', () => {
    expect(neighbours(ruta(), 'no-existe')).toEqual({ previous: null, next: null });
  });

  it('una ruta vacía no revienta', () => {
    expect(neighbours([], 'a')).toEqual({ previous: null, next: null });
  });
});

describe('nextPoint', () => {
  const build = (items: OutlineItem[]) => [...lineal([{ id: 'm1', items }]).values()];

  it('devuelve el primero sin completar aunque no se pueda abrir todavía', () => {
    const items = build([
      item({ assignmentId: 'n1', title: 'N1', position: 1, availableFrom: MANANA }),
      item({ assignmentId: 'n2', title: 'N2', position: 2 }),
    ]);

    expect(resumePoint(items)).toBeNull();
    expect(nextPoint(items)?.assignmentId).toBe('n1');
    expect(nextPoint(items)?.unavailableReason).toBe('NOT_YET');
  });

  it('con todo completado no hay nada por delante', () => {
    const items = build([item({ assignmentId: 'z', title: 'Z', status: 'COMPLETED' })]);
    expect(nextPoint(items)).toBeNull();
  });
});

describe('workshopStart', () => {
  const lengua = { subjectId: 's1', subjectName: 'Lengua castellana' };
  const items = [
    item({ assignmentId: '1', title: 'T1', ...lengua }),
    item({ assignmentId: '2', title: 'T2', ...lengua }),
    item({ assignmentId: '3', title: 'M1', subjectId: 's2', subjectName: 'Matemáticas' }),
    item({ assignmentId: '4', title: 'Final', kind: 'ASSESSMENT' }),
  ];

  it('dice el taller solo donde empieza, y nada donde no hay taller', () => {
    expect(items.map((_, i) => workshopStart(items, i))).toEqual([
      'Lengua castellana',
      null,
      'Matemáticas',
      null,
    ]);
  });
});
