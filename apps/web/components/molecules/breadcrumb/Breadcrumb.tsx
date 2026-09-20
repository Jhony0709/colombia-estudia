/**
 * Migas: dónde estás dentro del área. Un `<nav>` con lista ordenada y el último elemento
 * marcado con `aria-current="page"` (WAI-ARIA APG, breadcrumb). Va en el hueco `back` de
 * `PageHeader`, encima del overline.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export function Breadcrumb({ items, label = 'Migas' }: { items: Crumb[]; label?: string }) {
  return (
    <nav aria-label={label}>
      <ol className="type-caption text-text-muted m-0 flex list-none flex-wrap items-center gap-1 p-0">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="hover:text-text min-h-touch inline-flex items-center underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'text-text min-h-touch inline-flex items-center' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden="true" className="size-3.5" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
