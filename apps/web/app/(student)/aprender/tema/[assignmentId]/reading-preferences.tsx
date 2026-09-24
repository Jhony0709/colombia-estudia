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
import { Sheet } from '@/components/organisms/sheet';
import { cn } from '@/lib/utils';

type Size = 'base' | 'lg' | 'xl';
type Spacing = 'base' | 'wide';
type Width = 'base' | 'narrow';

interface Prefs {
  size: Size;
  spacing: Spacing;
  width: Width;
  /** Transcripción del vídeo desplegada al abrir el tema (plan/11-ux «Preferencias de lectura»). */
  transcriptOpen: boolean;
}

const KEY = 'ce:reading';
const DEFAULTS: Prefs = { size: 'base', spacing: 'base', width: 'base', transcriptOpen: false };

/** Lo dispara este panel al cambiar la preferencia; `transcript-panel.tsx` la escucha. */
export const TRANSCRIPT_PREF_EVENT = 'ce:transcript-pref';

/** Lee la preferencia de transcripción sin montar el panel (para el panel de transcripción). */
export function transcriptOpenPreference(): boolean {
  return load().transcriptOpen;
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      size: parsed.size === 'lg' || parsed.size === 'xl' ? parsed.size : 'base',
      spacing: parsed.spacing === 'wide' ? 'wide' : 'base',
      width: parsed.width === 'narrow' ? 'narrow' : 'base',
      transcriptOpen: parsed.transcriptOpen === true,
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

/**
 * Desde el 23/9 vive en una hoja que abre el menú del tema (`lesson-tools.tsx`): las
 * preferencias se tocan una vez y no merecen un bloque en línea entre el título y el texto.
 * El efecto de montaje sigue aquí: aplica lo guardado aunque nadie abra la hoja.
 */
export function ReadingPreferences({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
    if (patch.transcriptOpen !== undefined) {
      window.dispatchEvent(
        new CustomEvent(TRANSCRIPT_PREF_EVENT, { detail: { open: patch.transcriptOpen } })
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('title')} description={t('hint')}>
      <div className="space-y-4">
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
        <label className="min-h-touch flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={prefs.transcriptOpen}
            onChange={(event) => update({ transcriptOpen: event.target.checked })}
            className="border-border mt-1 size-5 cursor-pointer rounded-[4px] border accent-[var(--accent-base)]"
          />
          <span className="type-body text-text">
            {t('transcriptOpen')}
            <span className="type-caption text-text-muted block">{t('transcriptOpenHint')}</span>
          </span>
        </label>
      </div>
    </Sheet>
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
