import { copy } from '../copy';
import type { CohortGate } from './api';
import { longDate } from './format';

const t = copy.learn;

/** El texto de cada `gate` de la cohorte (`learn.gate.*` de es-CO.json). */
export function gateText(gate: CohortGate): { title: string; body: string } {
  switch (gate.kind) {
    case 'NOT_STARTED_YET':
      return {
        title: t.gate.NOT_STARTED_YET.title,
        body: t.gate.NOT_STARTED_YET.body(longDate(gate.startsOn)),
      };
    case 'ACCESS_EXPIRED':
      return {
        title: t.gate.ACCESS_EXPIRED.title,
        body: t.gate.ACCESS_EXPIRED.body(longDate(gate.accessUntil)),
      };
    default:
      return t.gate[gate.kind];
  }
}
