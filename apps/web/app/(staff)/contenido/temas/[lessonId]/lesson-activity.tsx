'use client';

/**
 * La actividad del tema, como sección propia (23/9, pieza 4 de la revisión UX): qué tiene
 * que entregar el estudiante y con qué. Solo existe en un tema que se completa con una
 * actividad (`requiresSubmission`); en los demás no se pinta.
 *
 * Va aparte de «Datos del tema» y del texto porque no es ninguna de las dos cosas: el texto
 * es lo que se estudia y la actividad es lo que se hace después. Y aparte de la versión
 * (decisión de Jhonny, 23/9): las instrucciones se corrigen en caliente, sin publicar.
 */

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { useToast } from '@/components/organisms/toaster';
import { Card } from '@/components/atoms/card';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

export type ActivityAccepts = 'TEXT' | 'FILE' | 'TEXT_OR_FILE';

const ACCEPTS: readonly ActivityAccepts[] = ['TEXT', 'FILE', 'TEXT_OR_FILE'];

export function LessonActivity({
  lessonId,
  initial,
}: {
  lessonId: string;
  initial: { instructions: string | null; accepts: ActivityAccepts; prompts: string[] };
}) {
  const t = useTranslations('editor.activity');
  const router = useRouter();
  const ids = { instructions: useId(), title: useId(), prompt: useId() };

  const [instructions, setInstructions] = useState(initial.instructions ?? '');
  const [accepts, setAccepts] = useState<ActivityAccepts>(initial.accepts);
  // Enunciados (24/9): con uno o más, el estudiante responde pregunta por pregunta.
  const [prompts, setPrompts] = useState<string[]>(initial.prompts);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const dirty =
    instructions !== (initial.instructions ?? '') ||
    accepts !== initial.accepts ||
    prompts.join('\n') !== initial.prompts.join('\n');

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/content/lessons/${lessonId}/activity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: instructions.trim(),
          accepts,
          prompts: accepts === 'FILE' ? [] : prompts.map((q) => q.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        toast({
          severity: 'error',
          title: apiErrorText(await res.json().catch(() => null), t('error')),
        });
        return;
      }
      toast({ severity: 'success', title: t('saved') });
      // El panel de preparación lee las instrucciones del servidor.
      router.refresh();
    } catch {
      toast({ severity: 'error', title: t('error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card labelledBy={ids.title}>
      <div className="space-y-1">
        <h2 id={ids.title} className="type-subheading text-text">
          {t('title')}
        </h2>
        <p className="type-caption text-text-muted max-w-reading">{t('hint')}</p>
      </div>

      <div>
        <label htmlFor={ids.instructions} className="type-label text-text block">
          {t('instructions')}
        </label>
        <p className="type-caption text-text-muted max-w-reading">{t('instructionsHint')}</p>
        <textarea
          id={ids.instructions}
          rows={6}
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value);
          }}
          className="border-border bg-surface-base text-text type-body rounded-control mt-1 w-full border p-3"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="type-label text-text">{t('accepts')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ACCEPTS.map((option) => (
            <label
              key={option}
              className={cn(
                'rounded-control flex cursor-pointer items-start gap-3 border p-3',
                accepts === option ? 'border-accent-base bg-surface-sunken' : 'border-border'
              )}
            >
              <input
                type="radio"
                name="activityAccepts"
                value={option}
                checked={accepts === option}
                onChange={() => {
                  setAccepts(option);
                }}
                className="mt-1"
              />
              {/* El texto a dos niveles del `label`: `jsx-a11y/label-has-associated-control` no mira más hondo. */}
              <span className="type-body text-text block">
                {t(`option.${option}`)}
                <span className="type-caption text-text-muted block">
                  {t(`optionHint.${option}`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {accepts !== 'FILE' && (
        <fieldset className="space-y-2">
          <legend className="type-label text-text">{t('prompts.title')}</legend>
          <p className="type-caption text-text-muted max-w-reading">{t('prompts.hint')}</p>
          {prompts.length > 0 && (
            <ol className="max-w-reading space-y-2">
              {prompts.map((prompt, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="type-body text-text-muted min-h-touch inline-flex w-6 shrink-0 items-center justify-end tabular-nums">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${ids.prompt}-${index}`} className="sr-only">
                      {t('prompts.label', { number: index + 1 })}
                    </label>
                    <textarea
                      id={`${ids.prompt}-${index}`}
                      rows={2}
                      value={prompt}
                      maxLength={1000}
                      onChange={(event) => {
                        const next = [...prompts];
                        next[index] = event.target.value;
                        setPrompts(next);
                      }}
                      className="border-border bg-surface-base text-text type-body rounded-control w-full border p-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={busy}
                    onClick={() => {
                      setPrompts(prompts.filter((_, i) => i !== index));
                    }}
                  >
                    {t('prompts.remove')}
                    <span className="sr-only"> {t('prompts.label', { number: index + 1 })}</span>
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <Button
            type="button"
            variant="quiet"
            disabled={busy || prompts.length >= 20}
            onClick={() => {
              setPrompts([...prompts, '']);
            }}
          >
            {t('prompts.add')}
          </Button>
        </fieldset>
      )}

      <div>
        <Button type="button" variant="secondary" loading={busy} disabled={!dirty} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </Card>
  );
}
