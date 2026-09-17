/**
 * Institution admin page: read-only overview.
 * SSOT: routes.md:56 (/admin/institucion, ADMIN), plan/03-identidad-y-acceso.md
 *
 * FocusManager (root layout) moves focus to the first h1 on route changes
 * (lib/a11y/focus-manager.tsx:21-34).
 */

import type { Metadata } from 'next';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getInstitutionOverview } from '@/features/admin/server/institution.service';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getRequestContext();
  return {
    title: `Institución · Admin · ${ctx.institution.name}`,
  };
}

export default async function InstitutionPage() {
  await requireCapability('institution.manage');
  const ctx = await getRequestContext();
  const overview = await getInstitutionOverview(ctx.institution.id);

  return (
    <section className="space-y-8 p-6">
      <h1 className="type-heading text-text outline-none" tabIndex={-1}>
        {overview.name}
      </h1>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="type-label text-text-muted">Dominio</dt>
          <dd className="type-body text-text">{overview.primaryDomain ?? '—'}</dd>
        </div>
        <div>
          <dt className="type-label text-text-muted">Versión de política de datos</dt>
          <dd className="type-body text-text">{overview.dataPolicyVersion}</dd>
        </div>
        {overview.dataPolicyUrl && (
          <div className="sm:col-span-2">
            <dt className="type-label text-text-muted">URL de política de datos</dt>
            <dd className="type-body">
              <a
                href={overview.dataPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-base hover:underline"
              >
                {overview.dataPolicyUrl}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="programs-heading">
        <h2 id="programs-heading" className="type-subheading text-text mb-4">
          Programas
        </h2>
        {overview.programs.length === 0 ? (
          <p className="type-body text-text-muted">Sin programas.</p>
        ) : (
          <ul className="space-y-2">
            {overview.programs.map((p) => (
              <li key={p.id} className="type-body text-text">
                <span className="font-medium">{p.code}</span> — {p.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-labelledby="help-heading" className="border-border border-t pt-6">
        <h2 id="help-heading" className="type-subheading text-text mb-2">
          Ayuda
        </h2>
        <p className="type-body text-text-muted">
          {overview.supportEmail}
          {overview.supportPhone && ` · ${overview.supportPhone}`}
        </p>
      </aside>
    </section>
  );
}
