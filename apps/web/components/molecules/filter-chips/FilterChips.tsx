/**
 * Los filtros aplicados, uno por chip, cada uno con su enlace que lo quita; y «Limpiar
 * filtros» al final. Todo son enlaces: el estado vive en la URL y no hace falta JavaScript.
 */

import Link from 'next/link';
import { X } from 'lucide-react';

export interface FilterChip {
  key: string;
  label: string;
  /** URL sin este filtro. */
  removeHref: string;
}

export function FilterChips({
  chips,
  clearHref,
  clearLabel,
  removeLabel,
}: {
  chips: FilterChip[];
  clearHref: string;
  clearLabel: string;
  /** Plantilla del nombre accesible del botón de quitar; `{label}` se sustituye. */
  removeLabel: (label: string) => string;
}) {
  if (chips.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.removeHref}
            aria-label={removeLabel(chip.label)}
            className="bg-status-info-muted text-status-info-base type-caption rounded-pill min-h-touch inline-flex items-center gap-1.5 px-3 font-medium hover:brightness-95"
          >
            {chip.label}
            <X aria-hidden="true" className="size-3.5" />
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={clearHref}
          className="type-caption text-text-link min-h-touch inline-flex items-center px-2 underline underline-offset-4"
        >
          {clearLabel}
        </Link>
      </li>
    </ul>
  );
}
