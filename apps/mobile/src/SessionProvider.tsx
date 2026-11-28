import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from './api';
import { copy } from './copy';
import { homeOf } from './roles';
import {
  abandon,
  currentUser,
  signIn as begin,
  signOut,
  verifyCode,
  type Me,
  type PendingMfa,
  type SignIn,
} from './session';

export type Notice = { tone: 'danger' | 'info'; title: string; text: string; link?: boolean };

export type SessionState =
  | { kind: 'checking' }
  | { kind: 'out'; notice?: Notice }
  | { kind: 'mfa'; pending: PendingMfa; notice?: Notice }
  | { kind: 'in'; me: Me };

interface Session {
  state: SessionState;
  signIn(email: string, password: string): Promise<void>;
  verify(code: string): Promise<void>;
  cancelMfa(): void;
  signOut(): Promise<void>;
}

const OTHER: Notice = { tone: 'info', title: copy.otherTitle, text: copy.other, link: true };

// Lo que no es 400, 401, 403 ni 429 es la red o el servidor (reference/03-ui/movil.md, M0).
const BY_STATUS: Record<number, string> = { 400: copy.checkFields, 429: copy.rateLimited };

export function failure(error: unknown): Notice {
  const status = error instanceof ApiError ? error.status : 0;
  if (error instanceof ApiError && status === 403) {
    return { tone: 'info', title: copy.mfaOffTitle, text: error.message, link: true };
  }
  const text =
    error instanceof ApiError && status === 401
      ? error.message
      : (BY_STATUS[status] ?? copy.offline);
  return { tone: 'danger', title: copy.errorTitle, text };
}

const after = (result: SignIn): SessionState =>
  result.kind === 'in'
    ? { kind: 'in', me: result.me }
    : result.kind === 'mfa'
      ? { kind: 'mfa', pending: result.pending }
      : { kind: 'out', notice: OTHER };

const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ kind: 'checking' });

  useEffect(() => {
    let live = true;
    currentUser()
      .then(async (me): Promise<SessionState> => {
        if (!me) return { kind: 'out' };
        if (homeOf(me)) return { kind: 'in', me };
        await signOut();
        return { kind: 'out', notice: OTHER };
      })
      .catch((error: unknown): SessionState => ({ kind: 'out', notice: failure(error) }))
      .then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, []);

  const session = useMemo<Session>(
    () => ({
      state,
      async signIn(email, password) {
        try {
          setState(after(await begin(email, password)));
        } catch (error) {
          setState({ kind: 'out', notice: failure(error) });
        }
      },
      async verify(code) {
        if (state.kind !== 'mfa') return;
        try {
          setState(after(await verifyCode(state.pending, code)));
        } catch (error) {
          const wrong = error instanceof ApiError && error.status === 400;
          setState(
            wrong
              ? { ...state, notice: { tone: 'danger', title: copy.mfaTitle, text: copy.mfaWrong } }
              : { kind: 'out', notice: failure(error) }
          );
        }
      },
      cancelMfa() {
        if (state.kind === 'mfa') void abandon(state.pending);
        setState({ kind: 'out' });
      },
      async signOut() {
        await signOut();
        setState({ kind: 'out' });
      },
    }),
    [state]
  );

  return <Context.Provider value={session}>{children}</Context.Provider>;
}

export function useSession(): Session {
  const session = useContext(Context);
  if (!session) throw new Error('Falta <SessionProvider>.');
  return session;
}
