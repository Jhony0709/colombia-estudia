/**
 * Person detail with PII.
 * SSOT: plan/06-cohortes-y-personas.md:33-37, endpoints.md:76 (person.pii_read).
 *
 * Opening this page writes `AuditLog person.pii_read`, and the page says so: operations
 * should know their access to someone's data leaves a trace.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getPersonDetail, resolvePerson } from '@/features/people/server/people.service';
import { getInvitationOverview } from '@/features/auth/server/invitations.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { AnonymizePerson } from './anonymize-person';
import { Alert } from '@/components/atoms/alert';
import { PersonRoles } from './person-roles';
import { PersonGuardians, PersonConsent } from './person-relationships';
import { PersonInvitation } from './person-invitation';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Detalle de persona' };

/** Fecha y hora en la zona de la institución, que `lib/i18n/request.ts` fija en Bogotá. */
const day = (format: Awaited<ReturnType<typeof getFormatter>>, iso: string) =>
  format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

type Params = Promise<{ personId: string }>;

export default async function PersonDetailPage({ params }: { params: Params }) {
  await requireCapability('people.manage');
  const ctx = await getRequestContext();
  const { personId: ref } = await params;

  // La URL lleva el código (`PER-0001`, 25/9); un enlace viejo con el `cuid` redirige.
  const resolved = await resolvePerson({ institutionId: ctx.institution.id, ref });
  if (!resolved) notFound();
  if (ref !== resolved.code) redirect(`/personas/${resolved.code}`);
  const personId = resolved.id;

  const [person, invitation, t, format] = await Promise.all([
    getPersonDetail({
      institutionId: ctx.institution.id,
      actorId: ctx.person?.id ?? null,
      personId,
    }),
    getInvitationOverview({ institutionId: ctx.institution.id, personId }),
    getTranslations('people'),
    getFormatter(),
  ]);

  if (!person) notFound();

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        overline={`${person.code} · ${t('overline')}`}
        title={`${person.givenName} ${person.familyName}`}
        description={t('auditNotice')}
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('people'), href: '/personas' },
              { label: `${person.givenName} ${person.familyName}` },
            ]}
          />
        }
      />

      {person.isMinor && <Alert severity="warning">{t('isMinor')}</Alert>}
      {person.anonymizedAt && <Alert severity="info">{t('anonymize.already')}</Alert>}

      <PageSection title={t('personalData')} id="datos" card>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="type-overline text-text-muted uppercase">{t('document')}</dt>
            <dd className="type-body text-text">
              {person.documentType ?? '—'} {person.documentNumber ?? ''}
            </dd>
          </div>
          <div>
            <dt className="type-overline text-text-muted uppercase">{t('birthDate')}</dt>
            <dd className="type-data text-text">{person.birthDate ?? '—'}</dd>
          </div>
          <div>
            <dt className="type-overline text-text-muted uppercase">{t('email')}</dt>
            <dd className="type-body text-text">{person.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="type-overline text-text-muted uppercase">{t('phone')}</dt>
            <dd className="type-body text-text">{person.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="type-overline text-text-muted uppercase">{t('invitation')}</dt>
            <dd className="type-body text-text">{t(`invitations.${person.invitation}`)}</dd>
          </div>
        </dl>
      </PageSection>

      {/* Sin envolver: el componente **es** su propia `PageSection`, y envolverlo dejaría
          dos encabezados para una sola sección.

          Las fechas se formatean **aquí**, en el servidor, y bajan como texto: `Intl` no da
          la misma cadena en Node y en el navegador, y eso rompía la hidratación. */}
      {invitation !== null && (
        <PersonInvitation
          personId={person.id}
          invitation={{
            state: invitation.state,
            hasEmail: invitation.hasEmail,
            mailConfigured: invitation.mailConfigured,
            expiresAtLabel:
              invitation.expiresAt === null ? null : day(format, invitation.expiresAt),
            acceptedAtLabel:
              invitation.acceptedAt === null ? null : day(format, invitation.acceptedAt),
            history: invitation.history.map((entry) => ({
              id: entry.id,
              sentBy: entry.sentBy,
              dead: entry.dead,
              sentAtLabel: day(format, entry.sentAt),
              expiresAtLabel: day(format, entry.expiresAt),
              acceptedAtLabel: entry.acceptedAt === null ? null : day(format, entry.acceptedAt),
            })),
          }}
        />
      )}

      <PageSection title={t('rolesTitle')} id="roles" card>
        <PersonRoles personId={person.id} roles={person.roles} />
      </PageSection>

      <PageSection title={t('enrollments')} id="matriculas" card>
        {person.enrollments.length === 0 ? (
          <p className="type-body text-text-muted">{t('noEnrollments')}</p>
        ) : (
          <ul className="space-y-2">
            {person.enrollments.map((e) => (
              <li key={e.id} className="type-body text-text">
                {e.cohortCode} — {e.cohortName} · {t(`enrollmentStatus.${e.status}`)} ·{' '}
                {t('accessUntil', { date: e.accessUntil })}
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection title={t('guardianship')} id="acudencia" card>
        <PersonGuardians personId={person.id} guardians={person.guardians} />

        {person.wards.length > 0 && (
          <ul className="space-y-1">
            {person.wards.map((w) => (
              <li key={w.id} className="type-body text-text">
                {t('wardIs', { name: w.name, relationship: w.relationship })}
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection title={t('consents')} id="consentimientos" card>
        {person.consents.length === 0 ? (
          <p className="type-body text-text-muted">{t('noConsents')}</p>
        ) : (
          <ul className="space-y-1">
            {person.consents.map((c) => (
              <li key={c.id} className="type-body text-text">
                {t('consentLine', {
                  version: c.policyVersion,
                  channel: c.channel,
                  signedBy: c.signedBy,
                  date: c.grantedAt.slice(0, 10),
                })}
                {c.revokedAt && ` · ${t('consentRevoked')}`}
              </li>
            ))}
          </ul>
        )}

        <PersonConsent personId={person.id} isMinor={person.isMinor} />
      </PageSection>

      {/* Ley 1581 (Fase 6): al final y solo para quien administra la institución. */}
      {!person.anonymizedAt && (ctx.capabilities.get('institution.manage')?.length ?? 0) > 0 && (
        <PageSection
          title={t('anonymize.title')}
          description={t('anonymize.hint')}
          id="anonimizar"
          card
        >
          <AnonymizePerson personId={person.id} name={`${person.givenName} ${person.familyName}`} />
        </PageSection>
      )}
    </Page>
  );
}
