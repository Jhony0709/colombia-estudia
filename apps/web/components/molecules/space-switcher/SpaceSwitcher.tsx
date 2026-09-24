'use client';

/**
 * SpaceSwitcher: el conmutador de espacios en la marca (ola 3 UX, 23/9). Solo existe para
 * quien tiene dos o más espacios (`lib/nav/spaces.ts`); con uno, la barra pinta el enlace de
 * la marca de siempre. Va en la barra lateral del staff y en la superior del estudiante y
 * del acudiente, con el mismo aspecto: el nombre de la institución, el espacio actual debajo
 * en pequeño y una flecha; el menú lista los espacios y marca el actual.
 *
 * Es un `Dropdown` (Radix) por lo mismo que el menú de la persona: teclado, foco y cierre
 * con Escape sin código propio.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import { BrandLogo } from '@/components/atoms/brand-logo';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import { spaceOf, type Space } from '@/lib/nav/spaces';
import { cn } from '@/lib/utils';

export interface SpaceSwitcherProps {
  institutionName: string;
  spaces: Space[];
  /** Adónde lleva la marca cuando no hay conmutador (un solo espacio). */
  homeHref: string;
  className?: string;
}

export function SpaceSwitcher({
  institutionName,
  spaces,
  homeHref,
  className,
}: SpaceSwitcherProps) {
  const path = usePathname() as string | null;
  const router = useRouter();
  const current = spaceOf(spaces, path);

  if (spaces.length < 2) {
    return (
      <Link
        href={homeHref as Route}
        className={cn(
          'type-body-emphasis text-text min-h-touch flex items-center gap-2',
          className
        )}
      >
        <BrandLogo variant="isotipo" alt="" className="h-7" />
        <span className="truncate">{institutionName}</span>
      </Link>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          type="button"
          className={cn(
            'text-text min-h-touch rounded-control hover:bg-surface-sunken flex max-w-full items-center gap-2 text-left',
            className
          )}
          aria-label={
            current ? `Cambiar de espacio, ahora en ${current.label}` : 'Cambiar de espacio'
          }
        >
          <BrandLogo variant="isotipo" alt="" className="h-7 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="type-body-emphasis truncate">{institutionName}</span>
            {current && (
              <span className="type-caption text-text-muted truncate">{current.label}</span>
            )}
          </span>
          <ChevronsUpDown aria-hidden className="text-text-muted size-4 shrink-0" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Espacios">
        {spaces.map((space) => {
          const active = current?.key === space.key;
          return (
            <DropdownItem
              key={space.key}
              itemKey={space.key}
              onSelect={() => router.push(space.href as Route)}
              endContent={active ? <Check aria-hidden className="size-4" /> : undefined}
            >
              {space.label}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
}
