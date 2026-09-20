/** @jest-environment node */
/**
 * La secuencia del programa: qué puede abrir un estudiante y por qué no lo otro.
 * SSOT: plan/08-aprender-y-evaluar.md:12-19, reference/01-routing/routes.md:27.
 *
 * Puro: sin base de datos y sin mocks. Es la regla que decide si alguien puede estudiar.
 */

import {
  sequence,
  sortItems,
  resumePoint,
  progressOf,
  neighbours,
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

const lineal = (modules: Array<{ id: string; items: OutlineItem[] }>) =>
  sequence({ modules, progression: 'LINEAR', now: NOW });

describe('sortItems', () => {
  it('los temas van antes que las evaluaciones del mismo módulo', () => {
    const mezcla = [
      item({ assignmentId: 'e1', title: 'Eval', kind: 'ASSESSMENT', position: 1 }),
      item({ assignmentId: 't2', title: 'Tema 2', position: 2 }),
      item({ assignmentId: 't1', title: 'Tema 1', position: 1 }),
    ];

    expect(sortItems(mezcla).map((i) => i.assignmentId)).toEqual(['t1', 't2', 'e1']);
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
