/**
 * People list for operations.
 * SSOT: routes.md:51 (/personas, OPERATIONS + ADMIN), plan/06-cohortes-y-personas.md:31-37
 *
 * Filters live in the URL because the form is a plain GET form: no client component, no
 * JavaScript needed, the filter survives a refresh and can be pasted to a colleague — which
 * is exactly what "filtros persistentes en la URL" (plan/06:80) asks for.
 *
 * Piloto del panel (19/9, PRODUCT_DECISIONS): migas, indicadores con el número actual, chips
 * de filtros aplicados, tabla con selección y menú por fila, orden y tamaño de página en la
 * URL, y carril lateral con lo urgente y lo reciente. Todo de servidor salvo la selección y
 * los menús (people-actions.tsx).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Clock3, GraduationCap, MailWarning, Users } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import {
  getPeopleStats,
  listExpiringInvitations,
  listPeople,
  listRecentPeopleActivity,
  parsePeopleFilters,
  PAGE_SIZES,
  PEOPLE_SORTS,
  ROLES,
  INVITATION_STATES,
  type PeopleFilters,
  type PersonRow,
} from '@/features/people/server/people.service';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { FilterChips, type FilterChip } from '@/components/molecules/filter-chips';
import {
  RowSelectionProvider,
  SelectAllCell,
  SelectRowCell,
} from '@/components/molecules/row-selection';
import { WithRail } from '@/components/molecules/rail';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { Page, PageHeader } from '@/components/templates/page';
import { BulkActions, PersonRowActions } from './people-actions';
import { PeopleRail } from './people-rail';

export const metadata: Metadata = { title: 'Personas' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Query string for a filter state; empty values are left out, page 1 is implicit. */
function queryFor(f: Partial<PeopleFilters>, page?: number): string {
  const search = new URLSearchParams();
  if (f.q) search.set('q', f.q);
  if (f.role) search.set('rol', f.role);
  if (f.invitation) search.set('invitacion', f.invitation);
  if (f.sort && f.sort !== 'nombre') search.set('orden', f.sort);
  if (f.pageSize && f.pageSize !== 50) search.set('mostrar', String(f.pageSize));
  if (page && page > 1) search.set('pagina', String(page));
  const query = search.toString();
  return query ? `?${query}` : '';
}

function hrefFor(f: Partial<PeopleFilters>, page?: number): string {
  return `/personas${queryFor(f, page)}`;
}

/** Page numbers worth a link: first, last, and a window around the current one. */
function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  const pages = new Set<number>(
    [1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount)
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i]!;
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('gap');
    out.push(p);
  }
  return out;
}

export default async function PeoplePage({ searchParams }: { searchParams: SearchParams }) {
  await requireCapability('people.manage');
  const ctx = await getRequestContext();
  const now = new Date();

  const filters = parsePeopleFilters(await searchParams);
  const institutionId = ctx.institution.id;
  const [result, stats, expiring, activity, t, format] = await Promise.all([
    listPeople({ institutionId, filters, now }),
    getPeopleStats({ institutionId, now }),
    listExpiringInvitations({ institutionId, now }),
    listRecentPeopleActivity({ institutionId }),
    getTranslations('people'),
    getFormatter(),
  ]);

  const filtered = Boolean(filters.q || filters.role || filters.invitation);
  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: 'q',
      label: t('chipSearch', { q: filters.q }),
      removeHref: hrefFor({ ...filters, q: '' }),
    });
  if (filters.role)
    chips.push({
      key: 'rol',
      label: t(`roles.${filters.role}`),
      removeHref: hrefFor({ ...filters, role: null }),
    });
  if (filters.invitation)
    chips.push({
      key: 'invitacion',
      label: t(`invitations.${filters.invitation}`),
      removeHref: hrefFor({ ...filters, invitation: null }),
    });

  const pageIds = result.rows.map((p) => p.id);
  const reinvitable = result.rows
    .filter((p) => p.invitation === 'pending' || p.invitation === 'expired')
    .map((p) => p.id);
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);

  return (
    <Page wide>
      <PageHeader
        back={
          <Breadcrumb items={[{ label: t('home'), href: '/ingresar' }, { label: t('title') }]} />
        }
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild variant="secondary">
            <a href={`/api/people/export${queryFor(filters)}`}>{t('exportCsv')}</a>
          </Button>
        }
      />

      <section aria-label={t('stats.label')}>
        <StatGrid>
          <StatCard label={t('stats.total')} value={stats.total} icon={Users} href="/personas" />
          <StatCard
            label={t('stats.students')}
            value={stats.students}
            icon={GraduationCap}
            tone="success"
            href={hrefFor({ role: 'STUDENT' })}
          />
          <StatCard
            label={t('stats.pending')}
            value={stats.pendingInvitations}
            icon={Clock3}
            href={hrefFor({ invitation: 'pending' })}
          />
          <StatCard
            label={t('stats.expired')}
            value={stats.expiredInvitations}
            icon={MailWarning}
            tone="warning"
            href={hrefFor({ invitation: 'expired' })}
          />
        </StatGrid>
      </section>

      <WithRail
        railLabel={t('rail.activityTitle')}
        rail={<PeopleRail expiring={expiring} activity={activity} now={now} />}
      >
        {/* Los filtros en su tarjeta: son el mando de la lista, no la lista. */}
        <form
          method="get"
          className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-4 border p-5"
          role="search"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <FormField label={t('search')} name="q" hint={t('searchHint')} hintPlacement="icon">
                <FormInput name="q" type="search" defaultValue={filters.q} />
              </FormField>
            </div>
            <div className="w-48">
              <FormField label={t('role')} name="rol">
                <FormSelect name="rol" defaultValue={filters.role ?? ''}>
                  <option value="">{t('anyRole')}</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`roles.${role}`)}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </div>
            <div className="w-48">
              <FormField label={t('invitation')} name="invitacion">
                <FormSelect name="invitacion" defaultValue={filters.invitation ?? ''}>
                  <option value="">{t('anyInvitation')}</option>
                  {INVITATION_STATES.map((state) => (
                    <option key={state} value={state}>
                      {t(`invitations.${state}`)}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </div>
            {filters.sort !== 'nombre' && <input type="hidden" name="orden" value={filters.sort} />}
            {filters.pageSize !== 50 && (
              <input type="hidden" name="mostrar" value={filters.pageSize} />
            )}
            <Button type="submit" variant="secondary">
              {t('filter')}
            </Button>
          </div>
          <FilterChips
            chips={chips}
            clearHref={hrefFor({ sort: filters.sort, pageSize: filters.pageSize })}
            clearLabel={t('clearFilters')}
            removeLabel={(label) => t('removeFilter', { label })}
          />
        </form>

        <RowSelectionProvider>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-caption text-text-muted m-0" role="status">
              {t('resultCount', { count: result.total })}
            </p>
            <nav aria-label={t('sort')} className="type-caption flex items-center gap-1">
              <span className="text-text-muted">{t('sort')}:</span>
              {PEOPLE_SORTS.map((sort) => (
                <Link
                  key={sort}
                  href={hrefFor({ ...filters, sort })}
                  aria-current={filters.sort === sort ? 'true' : undefined}
                  className={`rounded-control min-h-touch inline-flex items-center px-2 ${
                    filters.sort === sort
                      ? 'bg-surface-sunken text-text font-semibold'
                      : 'text-text-link underline underline-offset-4'
                  }`}
                >
                  {t(`sorts.${sort}`)}
                </Link>
              ))}
            </nav>
          </div>

          <BulkActions reinvitable={reinvitable} />

          <DataTable<PersonRow>
            caption={t('tableCaption')}
            compactRows
            rows={result.rows}
            rowKey={(person) => person.id}
            empty={
              <EmptyState
                title={filtered ? t('emptyFiltered') : t('empty')}
                description={filtered ? t('emptyFilteredHint') : t('emptyHint')}
                supportEmail={ctx.institution.supportEmail}
              />
            }
            columns={[
              {
                key: 'select',
                header: <SelectAllCell ids={pageIds} label={t('selectAll')} />,
                headerLabel: t('selectAll'),
                narrow: true,
                cell: (person) => (
                  <SelectRowCell
                    id={person.id}
                    label={t('selectOne', { name: `${person.givenName} ${person.familyName}` })}
                  />
                ),
              },
              {
                key: 'code',
                header: t('code'),
                narrow: true,
                cell: (person) => <span className="font-mono">{person.code}</span>,
              },
              {
                key: 'name',
                header: t('name'),
                cell: (person) => (
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-status-info-muted text-status-info-base type-caption inline-flex size-8 shrink-0 items-center justify-center rounded-full font-semibold"
                    >
                      {person.givenName.charAt(0)}
                      {person.familyName.charAt(0)}
                    </span>
                    <Link
                      href={`/personas/${person.code}`}
                      className="text-text-link underline underline-offset-4"
                    >
                      {person.familyName}, {person.givenName}
                    </Link>
                  </span>
                ),
              },
              { key: 'email', header: t('email'), cell: (person) => person.emailMasked },
              {
                key: 'roles',
                header: t('role'),
                cell: (person) =>
                  person.roles.length === 0 ? (
                    '—'
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {person.roles.map((role) => (
                        <Badge key={role} variant="info">
                          {t(`roles.${role}`)}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
              {
                key: 'invitation',
                header: t('invitation'),
                // La palabra dice el estado; la píldora solo lo hace visible de lejos.
                cell: (person) => (
                  <Badge
                    variant={
                      person.invitation === 'accepted'
                        ? 'success'
                        : person.invitation === 'expired'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {t(`invitations.${person.invitation}`)}
                  </Badge>
                ),
              },
              {
                key: 'created',
                header: t('created'),
                cell: (person) => (
                  <time
                    dateTime={person.createdAt.toISOString()}
                    className="type-data text-text-muted"
                  >
                    {format.dateTime(person.createdAt, { dateStyle: 'medium' })}
                  </time>
                ),
              },
              {
                key: 'actions',
                header: t('actionsColumn'),
                narrow: true,
                cell: (person) => (
                  <PersonRowActions
                    personId={person.id}
                    personCode={person.code}
                    name={`${person.givenName} ${person.familyName}`}
                    canReinvite={person.invitation === 'pending' || person.invitation === 'expired'}
                  />
                ),
              },
            ]}
          />
        </RowSelectionProvider>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="type-caption text-text-muted m-0">
            {t('showingRange', { from, to, total: result.total })}
          </p>
          {result.pageCount > 1 && (
            <nav aria-label={t('pagination')} className="flex items-center gap-1">
              {result.page > 1 && (
                <Link
                  href={hrefFor(filters, result.page - 1)}
                  className="rounded-control min-h-touch min-w-touch text-text-link inline-flex items-center justify-center px-2 underline underline-offset-4"
                >
                  {t('previous')}
                </Link>
              )}
              {pageWindow(result.page, result.pageCount).map((p, i) =>
                p === 'gap' ? (
                  <span key={`gap-${i}`} aria-hidden="true" className="text-text-muted px-1">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={hrefFor(filters, p)}
                    aria-label={t('goToPage', { page: p })}
                    aria-current={p === result.page ? 'page' : undefined}
                    className={`rounded-control min-h-touch min-w-touch type-data inline-flex items-center justify-center px-2 ${
                      p === result.page
                        ? 'bg-accent-base text-text-on-accent'
                        : 'text-text hover:bg-surface-sunken'
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}
              {result.page < result.pageCount && (
                <Link
                  href={hrefFor(filters, result.page + 1)}
                  className="rounded-control min-h-touch min-w-touch text-text-link inline-flex items-center justify-center px-2 underline underline-offset-4"
                >
                  {t('next')}
                </Link>
              )}
            </nav>
          )}
          <nav aria-label={t('perPage')} className="type-caption flex items-center gap-1">
            <span className="text-text-muted">{t('perPage')}:</span>
            {PAGE_SIZES.map((size) => (
              <Link
                key={size}
                href={hrefFor({ ...filters, pageSize: size })}
                aria-current={filters.pageSize === size ? 'true' : undefined}
                className={`rounded-control min-h-touch type-data inline-flex items-center px-2 ${
                  filters.pageSize === size
                    ? 'bg-surface-sunken text-text font-semibold'
                    : 'text-text-link underline underline-offset-4'
                }`}
              >
                {size}
              </Link>
            ))}
            <span className="text-text-muted">{t('perPageUnit')}</span>
          </nav>
        </div>
      </WithRail>
    </Page>
  );
}
