'use client';

/**
 * Preferencias de lectura del tema: tamaño del texto, espacio entre líneas y ancho.
 * SSOT: plan/08 §2 («Preferencias de lectura»), WCAG 1.4.12 (espaciado) y 1.4.4 (tamaño).
 *
 * Se aplican como `data-reading-*` en `<html>` y el CSS de `.contenido` (globals.css) las
 * lee; se guardan en `localStorage`, que es del navegador de la persona y no del sistema
 * (no es un dato del estudiante; es cómo le gusta leer en ese aparato). Sin JavaScript no
 * hay panel y el tema se lee con los valores por defecto, que ya cumplen.
 */

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Size = 'base' | 'lg' | 'xl';
type Spacing = 'base' | 'wide';
type Width = 'base' | 'narrow';

interface Prefs {
  size: Size;
  spacing: Spacing;
  width: Width;
}

const KEY = 'ce:reading';
const DEFAULTS: Prefs = { size: 'base', spacing: 'base', width: 'base' };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      size: parsed.size === 'lg' || parsed.size === 'xl' ? parsed.size : 'base',
      spacing: parsed.spacing === 'wide' ? 'wide' : 'base',
      width: parsed.width === 'narrow' ? 'narrow' : 'base',
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const html = document.documentElement;
  html.dataset.readingSize = p.size;
  html.dataset.readingSpacing = p.spacing;
  html.dataset.readingWidth = p.width;
}

export function ReadingPreferences() {
  const t = useTranslations('learn.reading');
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    const initial = load();
    setPrefs(initial);
    apply(initial);
    return () => {
      // Al salir del tema, la interfaz vuelve a su tamaño: la preferencia es del contenido.
      const html = document.documentElement;
      delete html.dataset.readingSize;
      delete html.dataset.readingSpacing;
      delete html.dataset.readingWidth;
    };
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    apply(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento (modo privado): se aplica igual, solo no se recuerda.
    }
  };

  return (
    <details className="border-border-muted rounded-card border">
      <summary className="type-label min-h-touch inline-flex cursor-pointer items-center gap-2 px-4">
        <Settings2 className="size-4" aria-hidden="true" />
        {t('title')}
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <Group
          label={t('size')}
          value={prefs.size}
          options={[
            { value: 'base', label: t('sizeBase') },
            { value: 'lg', label: t('sizeLg') },
            { value: 'xl', label: t('sizeXl') },
          ]}
          onChange={(size) => update({ size })}
        />
        <Group
          label={t('spacing')}
          value={prefs.spacing}
          options={[
            { value: 'base', label: t('spacingBase') },
            { value: 'wide', label: t('spacingWide') },
          ]}
          onChange={(spacing) => update({ spacing })}
        />
        <Group
          label={t('width')}
          value={prefs.width}
          options={[
            { value: 'base', label: t('widthBase') },
            { value: 'narrow', label: t('widthNarrow') },
          ]}
          onChange={(width) => update({ width })}
        />
      </div>
    </details>
  );
}

function Group<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="type-caption text-text-muted float-left mr-2">{label}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'rounded-pill min-h-touch type-label inline-flex cursor-pointer items-center border px-3',
            value === o.value
              ? 'border-accent-base bg-surface-sunken text-text'
              : 'border-border text-text-muted'
          )}
        >
          <input
            type="radio"
            name={`${id}-${label}`}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
