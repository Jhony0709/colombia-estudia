/**
 * Page template: the frame every staff screen uses.
 * SSOT: plan/11-ux.md:10 ("Una acción principal por pantalla"), DESIGN.md §Tipografía.
 *
 * `display` is the area title (the `h1`), `subheading` the sections (`h2`). The header keeps
 * exactly one slot for the primary action, on purpose: a header that can hold five buttons
 * ends up holding five buttons.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageProps {
  children: ReactNode;
  /**
   * Marco ancho (`max-w-site`, 1240 px) para las pantallas con carril lateral (Personas desde
   * el 19/9): lista + columna de contexto no caben en 64rem. El resto sigue en `max-w-content`.
   */
  wide?: boolean;
}

/**
 * Centred column with the page's breathing room. Wraps every staff screen.
 *
 * `max-w-content` lee `--size-content-max`, que el 18/9 era 72rem y desde el 19/9 es 64rem
 * (1024 px): la razón para ir ancho —«un pasillo vacío a la derecha»— valía cuando el contenido
 * iba directamente sobre el fondo; con lienzo gris y tarjetas blancas, el pasillo es el lienzo
 * y la tarjeta ancha es lo que se lee a saltos. El texto corrido sigue limitado por
 * `max-w-reading` allí donde se lee; esto solo es el ancho del marco.
 */
export function Page({ children, wide = false }: PageProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full space-y-10 px-4 py-8 sm:px-6',
        wide ? 'max-w-site' : 'max-w-content'
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  /** Small label above the title, for where in the product this is. */
  overline?: string;
  title: string;
  /** One or two lines saying what this screen is for. */
  description?: string;
  /** The one primary action. Everything else belongs in the content. */
  action?: ReactNode;
  /** Breadcrumb or back link, rendered above the overline. */
  back?: ReactNode;
}

export function PageHeader({ overline, title, description, action, back }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          {overline && <p className="type-overline text-text-muted uppercase">{overline}</p>}
          {/* FocusManager moves focus here on every route change (lib/a11y/focus-manager.tsx). */}
          <h1 className="type-display text-text outline-none" tabIndex={-1}>
            {title}
          </h1>
          {/* Subrayado corto de marca (manual, 19/9). Decorativo: `brand.yellow` nunca porta estado ni texto. */}
          <span aria-hidden="true" className="bg-brand-yellow rounded-pill block h-1 w-10" />
          {description && <p className="type-body text-text-muted max-w-prose">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export interface PageSectionProps {
  /** Section heading (`h2`). Always present: a section without a name is a div. */
  title: string;
  description?: string;
  /** Secondary action for this section only. */
  action?: ReactNode;
  children: ReactNode;
  /** Set on the first section when it follows the header directly. */
  id?: string;
  /**
   * El contenido va en una tarjeta blanca, con el encabezado fuera. Para una sección que es
   * un formulario o un aviso —algo que se lee o se rellena— y no una lista: una lista ya es
   * su propia tarjeta (`DataTable`), y una tarjeta dentro de otra no crea jerarquía.
   */
  card?: boolean;
}

export function PageSection({
  title,
  description,
  action,
  children,
  id,
  card = false,
}: PageSectionProps) {
  const headingId = `${id ?? title.toLowerCase().replace(/\s+/g, '-')}-heading`;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="type-subheading text-text">
            {title}
          </h2>
          {description && <p className="type-caption text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {card ? (
        <div className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-4 border p-5">
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
