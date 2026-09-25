/**
 * Carril lateral de Personas (19/9): invitaciones a punto de vencer y actividad reciente.
 */

import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Clock3, History } from 'lucide-react';
import type { ExpiringInvitation, PeopleActivity } from '@/features/people/server/people.service';
import { ActivityFeed, RailCard } from '@/components/molecules/rail';

const DAY = 24 * 60 * 60 * 1000;
const KNOWN = new Set([
  'person_pii_export',
  'invitation_sent',
  'invitation_accepted',
  'membership_granted',
  'membership_revoked',
  'guardianship_linked',
  'guardianship_unlinked',
  'consent_recorded',
]);

export async function PeopleRail({
  expiring,
  activity,
  now = new Date(),
}: {
  expiring: ExpiringInvitation[];
  activity: PeopleActivity[];
  now?: Date;
}) {
  const [t, format] = await Promise.all([getTranslations('people.rail'), getFormatter()]);
  return (
    <>
      <RailCard id="rail-expiring" title={t('expiringTitle')} icon={Clock3} tone="warning">
        {expiring.length === 0 ? (
          <p className="type-caption text-text-muted m-0">{t('expiringEmpty')}</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {expiring.map((inv) => {
              const days = Math.max(0, Math.round((inv.expiresAt.getTime() - now.getTime()) / DAY));
              return (
                <li key={inv.personId} className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/personas/${inv.personCode}`}
                    className="type-body text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                  >
                    {inv.familyName}, {inv.givenName}
                  </Link>
                  <span className="type-caption text-text-muted whitespace-nowrap">
                    {t('expiresIn', { days })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/personas?invitacion=pending"
          className="type-caption text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
        >
          {t('seeAllPending')}
        </Link>
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
