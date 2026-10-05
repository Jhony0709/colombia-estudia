'use client';

/**
 * El selector de matrícula de `/aprender` (E2, 23/9): solo existe con dos o más. Va en la
 * tarjeta de la tarea, donde antes estaba el overline «programa · cohorte» a secas: se
 * pulsa y se cambia de programa; la URL (`?matricula=`) sigue siendo la verdad. Sustituye
 * a la lista «Tus otros programas», que empujaba la ruta a dos pantallas de distancia en
 * el teléfono; lo que decía cada fila (avance) va ahora en la descripción de cada opción.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/molecules/dropdown';

export interface EnrollmentOption {
  enrollmentId: string;
  programName: string;
  code: string;
  cohortName: string;
  completed: number;
  total: number;
}

export function EnrollmentSwitcher({
  options,
  selectedId,
  tone = 'default',
}: {
  options: EnrollmentOption[];
  selectedId: string;
  /** `on-accent` (4/10): dentro del héroe azul de `/aprender`. */
  tone?: 'default' | 'on-accent';
}) {
  const t = useTranslations('learn');
  const router = useRouter();
  const selected = options.find((o) => o.enrollmentId === selectedId) ?? options[0]!;

  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          type="button"
          className={cn(
            'type-overline rounded-control min-h-touch -ml-2 inline-flex max-w-full items-center gap-1 px-2 uppercase',
            tone === 'on-accent'
              ? 'text-text-on-accent opacity-90 hover:opacity-100'
              : 'text-text-muted hover:bg-surface-sunken hover:text-text'
          )}
          aria-label={t('switcher.label', { program: selected.programName, code: selected.code })}
        >
          <span className="truncate">
            {selected.programName} · {selected.code}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label={t('switcher.menu')}>
        {options.map((option) => (
          <DropdownItem
            key={option.enrollmentId}
            itemKey={option.enrollmentId}
            description={`${option.code} · ${option.cohortName} · ${t('progress', {
              completed: option.completed,
              total: option.total,
            })}`}
            endContent={
              option.enrollmentId === selectedId ? (
                <Check aria-hidden className="size-4" />
              ) : undefined
            }
            onSelect={() => router.push(`/aprender?matricula=${option.enrollmentId}`)}
          >
            {option.programName}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
