/**
 * Person detail with PII.
 * SSOT: plan/06-cohortes-y-personas.md:33-37, endpoints.md:76 (person.pii_read).
 *
 * Opening this page writes `AuditLog person.pii_read`, and the page says so: operations
 * should know their access to someone's data leaves a trace.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
  const can = (capability: Parameters<typeof ctx.capabilities.get>[0]) =>
    (ctx.capabilities.get(capability)?.length ?? 0) > 0;
  const latest = person.enrollments[0] ?? null;
  const enrollmentHref = (e: { id: string; cohortId: string }) =>
    `/cohortes/${e.cohortId}/matriculas/${e.id}` as const;
  // Acudencia a la vista si es menor o ya tiene vínculos; si no, va con lo secundario.
  const guardianshipFirst =
    person.isMinor || person.guardians.length > 0 || person.wards.length > 0;
  const canAnonymize = !person.anonymizedAt && can('institution.manage');

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
        action={
          // El atajo de la ficha (4/10): de la persona a su matrícula más reciente, que es
          // donde se habilitan componentes y se ven progreso, ajustes y cartera.
          latest ? (
            <Link
              href={enrollmentHref(latest)}
              className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
            >
              {t('openEnrollmentNamed', { cohort: latest.cohortCode })}
            </Link>
          ) : undefined
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

      <PageSection title={t('enrollments')} id="matriculas" card>
        {person.enrollments.length === 0 ? (
          <p className="type-body text-text-muted">{t('noEnrollments')}</p>
        ) : (
          <ul className="divide-border-muted -my-2 divide-y">
            {person.enrollments.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 py-2">
                <span className="type-body text-text min-w-0">
                  <Link
                    href={enrollmentHref(e)}
                    aria-label={t('openEnrollmentNamed', { cohort: e.cohortCode })}
                    className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                  >
                    {e.cohortCode} — {e.cohortName}
                  </Link>
                  <span className="type-caption text-text-muted block first-letter:uppercase">
                    {t(`enrollmentStatus.${e.status}`)} ·{' '}
                    {t('accessUntil', { date: e.accessUntil })}
                  </span>
                </span>
                {can('billing.manage') && (
                  <Link
                    href={`/cartera/${e.id}`}
                    aria-label={t('openBillingNamed', { cohort: e.cohortCode })}
                    className="text-text-link type-caption min-h-touch inline-flex items-center underline underline-offset-4"
                  >
                    {t('openBilling')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
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

      {guardianshipFirst && (
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
      )}

      {/* Lo que se consulta poco (4/10): plegado, con lo irreversible al final. */}
      <details className="group">
        <summary className="type-subheading text-text min-h-touch inline-flex cursor-pointer items-center gap-2">
          <ChevronRight
            aria-hidden
            className="duration-fast ease-standard size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          {t('more')}
        </summary>
        <div className="mt-6 space-y-8">
          {!guardianshipFirst && (
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
          )}
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
          {canAnonymize && (
            <div className="border-border-muted border-t pt-6">
              <PageSection
                title={t('anonymize.title')}
                description={t('anonymize.hint')}
                id="anonimizar"
              >
                <AnonymizePerson
                  personId={person.id}
                  name={`${person.givenName} ${person.familyName}`}
                />
              </PageSection>
            </div>
          )}
        </div>
      </details>
    </Page>
  );
}
