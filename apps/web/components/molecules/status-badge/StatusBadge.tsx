/**
 * StatusBadge: el estado de una entidad del dominio, con la palabra y el color decididos una
 * sola vez.
 *
 * Antes cada pantalla armaba su `Record<status, BadgeVariant>` y su `t(`statuses.${s}`)`:
 * seis copias del mapa de la cartera, tres del de la matrícula, y «Devueltas» (el filtro, en
 * plural) como etiqueta de una entrega sola. `docs/ux/decision-ux-2309.md` (ola 2) lo cierra:
 * un dominio → una tabla de tonos y un espacio de textos (`status.<dominio>.<ESTADO>`).
 *
 * Sigue siendo un `Badge`: la palabra es el estado y el color, refuerzo
 * (reference/03-ui/layout-y-componentes.md §Badge). Un estado que no esté en la tabla —una
 * enumeración nueva antes de actualizar esto— sale en neutro y con la clave cruda, que en
 * desarrollo se ve y en producción no rompe.
 */

import { useTranslations } from 'next-intl';
import { Badge, type BadgeVariant } from '@/components/atoms/badge/Badge';

const TONES = {
  cohort: { PLANNED: 'info', OPEN: 'success', CLOSED: 'neutral', ARCHIVED: 'neutral' },
  enrollment: { ACTIVE: 'success', COMPLETED: 'info', WITHDRAWN: 'neutral' },
  account: {
    CURRENT: 'success',
    OVERDUE: 'error',
    IN_AGREEMENT: 'warning',
    PARTNER_PAID: 'info',
    NO_PLAN: 'neutral',
  },
  installment: { OPEN: 'neutral', PARTIALLY_PAID: 'info', PAID: 'success', VOID: 'neutral' },
  agreement: { ACTIVE: 'info', FULFILLED: 'success', CANCELLED: 'neutral' },
  submission: { SUBMITTED: 'info', RETURNED: 'warning', APPROVED: 'success' },
  lesson: { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success' },
  attempt: { IN_PROGRESS: 'info', SUBMITTED: 'neutral', EXPIRED: 'warning', GRADED: 'success' },
} as const satisfies Record<string, Record<string, BadgeVariant>>;

export type StatusDomain = keyof typeof TONES;
export type StatusOf<D extends StatusDomain> = keyof (typeof TONES)[D] & string;

export interface StatusBadgeProps<D extends StatusDomain> {
  domain: D;
  /** El valor de la enumeración. Los servicios lo tipan como `string`; se acepta tal cual. */
  status: StatusOf<D> | (string & {});
  className?: string;
}

export function StatusBadge<D extends StatusDomain>({
  domain,
  status,
  className,
}: StatusBadgeProps<D>) {
  const t = useTranslations('status');
  const tones = TONES[domain] as Record<string, BadgeVariant>;
  const key = `${domain}.${status}`;

  return (
    <Badge variant={tones[status] ?? 'neutral'} className={className}>
      {t.has(key) ? t(key) : status}
    </Badge>
  );
}
