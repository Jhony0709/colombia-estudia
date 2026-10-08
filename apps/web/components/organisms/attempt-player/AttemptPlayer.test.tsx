/** @jest-environment jsdom */
/**
 * El intento, una pregunta por vista (27/9): qué se ve, cómo se navega y qué dice el índice.
 * SSOT: plan/08-aprender-y-evaluar.md §3, docs/estado.md (27/9, «El intento: Markdown en las
 * preguntas y una pregunta por vista»).
 */

import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttemptPlayer, type AttemptView } from './AttemptPlayer';

const mockRefresh = jest.fn();
const mockAnnounce = jest.fn();

// Los textos con parámetros se devuelven con ellos, para poder afirmar sobre números.
jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key;
    t.has = () => true;
    return t;
  },
  useFormatter: () => ({ dateTime: () => '10:00' }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock('@/lib/a11y/announce', () => ({ useAnnounce: () => ({ announce: mockAnnounce }) }));
jest.mock('@/lib/telemetry/student-events', () => ({ trackStudentEvent: jest.fn() }));
jest.mock('@/components/organisms/dialog', () => ({
  Dialog: ({
    open,
    children,
    title,
    actions,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
        {actions}
      </div>
    ) : null,
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const question = (n: number, points = 1): AttemptView['questions'][number] => ({
  code: `q${n}`,
  type: 'single_choice',
  text: `Pregunta ${n}`,
  textHtml: `<strong>Pregunta ${n}</strong>`,
  options: [
    { code: 'a', text: 'A', textHtml: 'A' },
    { code: 'b', text: 'B', textHtml: 'B' },
  ],
  points,
  answer: null,
  correct: null,
  pointsAwarded: null,
  feedback: null,
  feedbackHtml: null,
});

const attempt = (questions: AttemptView['questions']): AttemptView => ({
  id: 'att-1',
  assignmentId: 'as-1',
  number: 1,
  status: 'IN_PROGRESS',
  title: 'Examen',
  language: 'es-CO',
  instructions: null,
  instructionsHtml: null,
  closingText: null,
  timed: false,
  deadlineAt: null,
  serverNow: new Date().toISOString(),
  submittedAt: null,
  review: 'NONE',
  score: null,
  questions,
  outcome: null,
  attemptsLeft: 1,
  activeAttemptId: null,
  next: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  global.fetch = jest.fn(async () => ({
    ok: true,
    headers: { get: () => null },
    json: async () => ({ data: { savedAt: new Date().toISOString() } }),
  })) as unknown as typeof fetch;
});

describe('AttemptPlayer en curso', () => {
  it('muestra una sola pregunta, con su Markdown ya en HTML', () => {
    render(<AttemptPlayer attempt={attempt([question(1), question(2), question(3)])} />);

    expect(screen.getByText('Pregunta 1').tagName).toBe('STRONG');
    expect(screen.queryByText('Pregunta 2')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('Siguiente y Anterior cambian la pregunta; la primera no tiene Anterior', () => {
    render(<AttemptPlayer attempt={attempt([question(1), question(2)])} />);

    expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(screen.getByText('Pregunta 2')).toBeInTheDocument();
    expect(screen.queryByText('Pregunta 1')).not.toBeInTheDocument();
    // En la última, la acción primaria es Entregar y no hay Siguiente.
    expect(screen.queryByRole('button', { name: 'next' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'submit' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'previous' }));
    expect(screen.getByText('Pregunta 1')).toBeInTheDocument();
  });

  it('responder sube el avance y marca la pregunta en el índice; el índice salta a otra', () => {
    render(
      <AttemptPlayer attempt={attempt([question(1), question(2), question(3), question(4)])} />
    );

    fireEvent.click(screen.getByLabelText('A'));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

    const index = screen.getByRole('navigation', { name: 'indexLabel' });
    expect(index).toHaveTextContent('indexAnswered:1');
    expect(index).toHaveTextContent('indexUnanswered:2');

    fireEvent.click(screen.getByRole('button', { name: 'indexUnanswered:3' }));
    expect(screen.getByText('Pregunta 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'indexUnanswered:3' })).toHaveAttribute(
      'aria-current',
      'step'
    );
  });

  it('los puntos solo se dicen cuando difieren entre preguntas', () => {
    const { unmount } = render(<AttemptPlayer attempt={attempt([question(1), question(2)])} />);
    expect(screen.queryByText(/points:/)).not.toBeInTheDocument();
    unmount();

    render(<AttemptPlayer attempt={attempt([question(1, 1), question(2, 3)])} />);
    expect(screen.getByText(/points:1/)).toBeInTheDocument();
  });

  it('Entregar abre el diálogo con lo que falta por responder', () => {
    render(<AttemptPlayer attempt={attempt([question(1), question(2)])} />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('questionN:1');
    expect(dialog).toHaveTextContent('questionN:2');
  });
});

describe('entregar', () => {
  const saved = {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ data: { savedAt: new Date().toISOString() } }),
  };

  const answerAndSubmit = () => {
    fireEvent.click(screen.getByLabelText('A'));
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirmSubmit' }));
  };

  // 5/10: responder la última y entregar enseguida decía «Hay respuestas sin guardar».
  it('espera el guardado que va en camino antes de entregar', async () => {
    const calls: string[] = [];
    let release: () => void = () => undefined;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`);
      if (init?.method === 'PATCH') {
        return new Promise((resolve) => {
          release = () => resolve(saved);
        });
      }
      return Promise.resolve(saved);
    }) as unknown as typeof fetch;

    render(<AttemptPlayer attempt={attempt([question(1)])} />);
    answerAndSubmit();

    expect(calls).toEqual(['PATCH /api/learn/attempts/att-1']);
    await act(async () => release());
    await waitFor(() => expect(calls).toContain('POST /api/learn/attempts/att-1/submit'));
    expect(screen.queryByText('submitPendingError')).not.toBeInTheDocument();
  });

  it('con la sesión cerrada lo dice, en vez de culpar a la conexión', async () => {
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? {
            ok: false,
            status: 401,
            headers: { get: () => null },
            json: async () => ({
              error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
            }),
          }
        : saved
    ) as unknown as typeof fetch;

    render(<AttemptPlayer attempt={attempt([question(1)])} />);
    answerAndSubmit();

    expect(await screen.findByText('submitSessionError')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/learn/attempts/att-1/submit',
      expect.anything()
    );
  });
});

describe('el reloj', () => {
  const soon = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

  it('no aparece sin límite de tiempo, aunque el plazo esté cerca (27/9)', () => {
    render(<AttemptPlayer attempt={{ ...attempt([question(1)]), deadlineAt: soon() }} />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('aparece con límite de tiempo configurado', () => {
    render(
      <AttemptPlayer attempt={{ ...attempt([question(1)]), timed: true, deadlineAt: soon() }} />
    );
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });
});

describe('el resultado (8/10)', () => {
  const graded = (over: Partial<AttemptView>): AttemptView => ({
    ...attempt([question(1)]),
    status: 'GRADED',
    review: 'SCORE',
    submittedAt: new Date().toISOString(),
    ...over,
  });

  it('aprobado: el siguiente paso de la ruta, sin reintentar', () => {
    render(
      <AttemptPlayer
        attempt={graded({
          outcome: 'PASSED',
          score: { value: 2, max: 2, percent: 100, passed: true },
          next: { href: '/aprender/tema/as-2', title: 'Tema 2' },
        })}
      />
    );
    expect(screen.getByRole('heading', { name: 'result.passedTitle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /closing\.next/ })).toHaveAttribute(
      'href',
      '/aprender/tema/as-2'
    );
    expect(screen.queryByRole('link', { name: /closing\.retry/ })).not.toBeInTheDocument();
  });

  it('no aprobado con intentos: invita a reintentar y no deja seguir', () => {
    render(
      <AttemptPlayer
        attempt={graded({
          outcome: 'RETRY',
          attemptsLeft: 1,
          score: { value: 0, max: 2, percent: 0, passed: false },
        })}
      />
    );
    expect(screen.getByText('closing.lastAttempt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /closing\.retry/ })).toHaveAttribute(
      'href',
      '/aprender/examen/as-1'
    );
    expect(screen.queryByRole('link', { name: /closing\.next/ })).not.toBeInTheDocument();
  });

  it('sin intentos: la misma calma y el siguiente paso', () => {
    render(
      <AttemptPlayer
        attempt={graded({
          outcome: 'DONE',
          attemptsLeft: 0,
          score: { value: 0, max: 2, percent: 0, passed: false },
          next: { href: '/aprender/examen/as-3', title: null },
        })}
      />
    );
    expect(screen.getByRole('heading', { name: 'result.doneTitle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /closing\.next/ })).toHaveAttribute(
      'href',
      '/aprender/examen/as-3'
    );
  });

  it('visto desde el historial, si aprobó en otro intento lo dice y deja seguir', () => {
    render(
      <AttemptPlayer
        attempt={graded({
          outcome: 'PASSED_OTHER',
          attemptsLeft: 0,
          score: { value: 0, max: 2, percent: 0, passed: false },
          next: { href: '/aprender/curso/en-1', title: null },
        })}
      />
    );
    expect(screen.getByRole('heading', { name: 'result.passedOtherTitle' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /closing\.retry/ })).not.toBeInTheDocument();
  });
});
