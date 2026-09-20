/** Carril de Cohortes (19/9): lo que empieza o termina en 30 días, y la actividad reciente. */

import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CalendarClock, History } from 'lucide-react';
import type { UpcomingCohort } from '@/features/cohorts/server/cohorts.service';
import type { RecentActivity } from '@/lib/audit/recent-activity';
import { ActivityFeed, RailCard } from '@/components/molecules/rail';

const KNOWN = new Set([
  'cohort_created',
  'cohort_opened',
  'cohort_closed',
  'enrollment_created',
  'enrollment_withdrawn',
  'enrollment_extended',
  'import_run',
]);

export async function CohortsRail({
  upcoming,
  activity,
}: {
  upcoming: UpcomingCohort[];
  activity: RecentActivity[];
}) {
  const [t, format] = await Promise.all([getTranslations('cohorts.rail'), getFormatter()]);
  return (
    <>
      <RailCard id="rail-upcoming" title={t('upcomingTitle')} icon={CalendarClock} tone="info">
        {upcoming.length === 0 ? (
          <p className="type-caption text-text-muted m-0">{t('upcomingEmpty')}</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {upcoming.map((c) => (
              <li key={`${c.id}-${c.kind}`} className="flex flex-col">
                <Link
                  href={`/cohortes/${c.id}`}
                  className="type-body text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                >
                  {c.code}
                </Link>
                <span className="type-caption text-text-muted">
                  {t(c.kind, { date: format.dateTime(c.on, { dateStyle: 'medium' }) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RailCard>
      <RailCard id="rail-activity" title={t('activityTitle')} icon={History}>
        <ActivityFeed
          empty={t('activityEmpty')}
          by={(name) => t('by', { name })}
          items={activity.map((a) => {
            const key = `${a.entity}_${a.action}`;
            return {
              id: a.id,
              label: KNOWN.has(key)
                ? t(`event.${key}`)
                : t('event.other', { entity: a.entity, action: a.action }),
              occurredAt: a.occurredAt,
              when: format.dateTime(a.occurredAt, { dateStyle: 'medium', timeStyle: 'short' }),
              actorName: a.actorName,
            };
          })}
        />
      </RailCard>
    </>
  );
}
