'use client';

/**
 * Elegir el tema: claro, oscuro o el del equipo.
 * SSOT: `apps/web/lib/theme/theme.ts`.
 *
 * Tres botones de alternancia con `aria-pressed`, y no un grupo de radios: un grupo de radios
 * obliga a mover el foco con las flechas y a sacar del tabulador los dos no elegidos, que es
 * bastante maquinaria para tres botones que caben en una fila. Con `aria-pressed` el tabulador
 * los recorre y cualquiera de los tres se pulsa con Intro o espacio.
 *
 * El alto lo pone el carril, no el botón (`min-h-control`, como `NavItem`): en la columna de
 * escritorio, que va en `density-compact`, los tres quedan a 36 px como las filas de al lado;
 * en el cajón del teléfono, a 44. Con `min-h-touch` eran tres botones de 44 entre filas de 36.
 *
 * El cambio se aplica a mano sobre `<html>` ANTES de que el servidor se entere
 * (`lib/theme/apply-theme.ts`, compartido con el menú del estudiante desde el 22/9). La
 * cookie es lo que hace que la próxima carga ya venga bien; sin tocar la clase, el tema no
 * cambiaría hasta recargar, que no es lo que espera nadie que pulsa un botón.
 */

import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { Theme } from '@/lib/theme/theme';
import { applyTheme, THEME_OPTIONS } from '@/lib/theme/apply-theme';
import { Tooltip } from '@/components/atoms/tooltip';
import { cn } from '@/lib/utils';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

const OPTIONS = THEME_OPTIONS.map((option) => ({ ...option, Icon: ICONS[option.value] }));

export function ThemeToggle({ theme }: { theme: Theme }) {
  const [current, setCurrent] = useState<Theme>(theme);

  function choose(next: Theme) {
    setCurrent(next);
    applyTheme(next);
  }

  return (
    <div className="flex gap-1 px-3 pt-2" role="group" aria-label="Tema">
      {OPTIONS.map(({ value, label, Icon }) => (
        <Tooltip key={value} label={label}>
          <button
            type="button"
            aria-pressed={current === value}
            onClick={() => choose(value)}
            className={cn(
              'rounded-control min-h-control min-w-control flex items-center justify-center',
              'duration-fast ease-standard transition-colors',
              current === value
                ? 'bg-surface-sunken text-text'
                : 'text-text-muted hover:bg-surface-sunken hover:text-text'
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
