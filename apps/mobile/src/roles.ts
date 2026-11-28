import type { Me } from './session';

/** Dónde empieza cada rol (reference/03-ui/movil.md, «Sesión iniciada»). */
export type Home = '/mensajes' | '/aprender';

export function homeOf(me: Me): Home | null {
  if (me.roles.some((role) => role === 'ADMIN' || role === 'OPERATIONS')) return '/mensajes';
  if (me.roles.includes('STUDENT')) return '/aprender';
  return null;
}
