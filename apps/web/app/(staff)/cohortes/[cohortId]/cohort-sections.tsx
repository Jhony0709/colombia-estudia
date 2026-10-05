/**
 * Las pestañas de la cohorte (4/10, auditoría de Gestión): las mismas en la ficha, en
 * Actividades y en Avance, para que cambiar de pestaña no haga desaparecer la barra. Cada
 * destino se muestra solo a quien puede abrirlo; Cartera sale a otra área y lo dice.
 */

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { SectionNav, type SectionNavItem } from '@/components/molecules/section-nav';
import { getCohortNavCounts } from '@/features/cohorts/server/cohort-nav.service';

type Capabilities = ReadonlyMap<string, readonly unknown[]>;

export async function CohortSections({
  institutionId,
  cohortId,
  capabilities,
  counts,
  routeCount,
}: {
  institutionId: string;
  cohortId: string;
  capabilities: Capabilities;
  /** La ficha ya los tiene; las demás páginas los piden aquí. */
  counts?: { personas: number; actividades: number; sesiones: number };
  /** Novedades de la ruta: solo la ficha las calcula. */
  routeCount?: number;
}) {
  const can = (capability: string) => (capabilities.get(capability)?.length ?? 0) > 0;
  const [tc, resolved] = await Promise.all([
    getTranslations('cohorts'),
    counts ?? getCohortNavCounts({ institutionId, cohortId }),
  ]);

  const base = `/cohortes/${cohortId}`;
  const manage = can('cohort.manage');
  const items: SectionNavItem[] = [
    ...(manage
      ? [
          { href: base as Route, label: tc('sections.resumen') },
          { href: `${base}?seccion=ruta` as Route, label: tc('sections.ruta'), count: routeCount },
          {
            href: `${base}?seccion=personas` as Route,
            label: tc('sections.personas'),
            count: resolved.personas,
          },
        ]
      : []),
    ...(can('assessment.grade')
      ? [
          {
            href: `${base}/actividades` as Route,
            label: tc('sections.actividades'),
            count: resolved.actividades,
          },
        ]
      : []),
    ...(can('progress.read.cohort')
      ? [{ href: `${base}/avance` as Route, label: tc('sections.avance') }]
      : []),
    ...(manage
      ? [
          {
            href: `${base}?seccion=sesiones` as Route,
            label: tc('sections.sesiones'),
            count: resolved.sesiones,
          },
        ]
      : []),
    ...(can('billing.manage')
      ? [
          {
            href: `/cartera?cohorte=${cohortId}` as Route,
            label: tc('sections.cartera'),
            external: true,
          },
        ]
      : []),
  ];

  // Una sola pestaña no es navegación: el instructor que solo revisa actividades no la ve.
  if (items.length < 2) return null;
  return <SectionNav label={tc('sections.label')} items={items} />;
}
