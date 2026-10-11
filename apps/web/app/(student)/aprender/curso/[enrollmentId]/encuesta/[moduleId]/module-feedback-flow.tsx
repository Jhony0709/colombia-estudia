'use client';

/** Encuesta del componente (11/10) con `ConversationalForm` (experiencia §4). */

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, CircleCheck } from 'lucide-react';
import {
  ConversationalForm,
  type ConversationStep,
} from '@/components/organisms/conversational-form';
import { RatingScale } from '@/components/molecules/rating-scale';
import { FormField, FormTextarea } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { motionReduced } from '@/lib/motion/preference';
import { FEEDBACK_COMMENT_MAX } from '@/features/feedback/feedback-constants';
import { UnlockRequestButton } from '../../../../unlock-request-button';

type Score = 'usefulness' | 'understanding' | 'clarity' | 'support';
type Words = [string, string, string, string, string];

export function ModuleFeedbackFlow({
  enrollmentId,
  moduleId,
  firstName,
  backHref,
  nextLocked,
}: {
  enrollmentId: string;
  moduleId: string;
  firstName: string;
  backHref: string;
  /** El siguiente componente bloqueado, para pedirlo al terminar. */
  nextLocked: { id: string; name: string; requestedAt: string | null } | null;
}) {
  const t = useTranslations('moduleFeedback');
  const { announce } = useAnnounce();
  const [scores, setScores] = useState<Record<Score, number | null>>({
    usefulness: null,
    understanding: null,
    clarity: null,
    support: null,
  });
  const [supportSkipped, setSupportSkipped] = useState(false);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<{ id: string; token: number; error: string } | null>(null);
  const [done, setDone] = useState(false);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  const words = (key: Score) => t.raw(`questions.${key}.words`) as Words;
  const answerFor = (key: Score) => {
    if (key === 'support' && supportSkipped) return t('questions.support.skip');
    const value = scores[key];
    return value === null ? '' : t('answer', { value, word: words(key)[value - 1] ?? '' });
  };

  // Lo elegido se ve un instante antes de avanzar (P3); con movimiento reducido, al momento.
  const choose = (key: Score, value: number, advance: () => void) => {
    setScores((current) => ({ ...current, [key]: value }));
    if (key === 'support') setSupportSkipped(false);
    window.setTimeout(advance, motionReduced() ? 0 : 180);
  };

  const scaleStep = (key: Score, prompt: string): ConversationStep => ({
    id: key,
    section: t(`sections.${key}`),
    prompt,
    answer: answerFor(key),
    kind: 'choice',
    field: ({ advance }) => (
      <div className="space-y-3">
        <RatingScale
          label={prompt}
          value={scores[key]}
          words={words(key)}
          low={words(key)[0]}
          high={words(key)[4]}
          valueLabel={(value, word) => t('valueLabel', { value, word })}
          onSelect={(value) => choose(key, value, advance)}
        />
        {key === 'support' && (
          <Button
            type="button"
            variant="quiet"
            aria-pressed={supportSkipped}
            onClick={() => {
              setScores((current) => ({ ...current, support: null }));
              setSupportSkipped(true);
              advance();
            }}
          >
            {t('questions.support.skip')}
          </Button>
        )}
      </div>
    ),
  });

  const steps: ConversationStep[] = [
    scaleStep('usefulness', t('questions.usefulness.prompt', { name: firstName })),
    scaleStep('understanding', t('questions.understanding.prompt')),
    scaleStep('clarity', t('questions.clarity.prompt')),
    scaleStep('support', t('questions.support.prompt')),
    {
      id: 'comment',
      section: t('sections.comment'),
      prompt: t('comment.prompt'),
      answer: comment.trim() ? comment.trim() : t('comment.empty'),
      validate: () =>
        comment.trim().length > FEEDBACK_COMMENT_MAX
          ? t('comment.tooLong', { max: FEEDBACK_COMMENT_MAX })
          : null,
      secondary: { label: t('comment.skip'), onSelect: () => setComment('') },
      field: () => (
        <div className="space-y-1">
          <FormField label={t('comment.label')} name="comment" hint={t('comment.hint')}>
            <FormTextarea
              name="comment"
              rows={4}
              maxLength={FEEDBACK_COMMENT_MAX}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('comment.placeholder')}
            />
          </FormField>
          <p className="type-caption text-text-muted m-0 text-right tabular-nums">
            {t('comment.count', { count: comment.length, max: FEEDBACK_COMMENT_MAX })}
          </p>
        </div>
      ),
    },
  ];

  const submit = async () => {
    // Lo obligatorio es responder los tres medidores; la atención puede ser «No la necesité».
    const missing = (['usefulness', 'understanding', 'clarity'] as const).find(
      (key) => scores[key] === null
    );
    const supportMissing = scores.support === null && !supportSkipped;
    if (missing || supportMissing) {
      setJumpTo({ id: missing ?? 'support', token: Date.now(), error: t('missing') });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/learn/enrollments/${enrollmentId}/modules/${moduleId}/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usefulness: scores.usefulness,
            understanding: scores.understanding,
            clarity: scores.clarity,
            support: supportSkipped ? null : scores.support,
            comment: comment.trim() ? comment.trim() : null,
          }),
        }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return;
      }
      setDone(true);
      announce(t('done.title'));
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <section aria-labelledby="encuesta-gracias" className="motion-enter-md space-y-5">
        <span className="bg-status-success-muted text-status-success-base inline-flex size-12 items-center justify-center rounded-full">
          <CircleCheck aria-hidden className="size-6" />
        </span>
        <div className="space-y-2">
          <h2
            id="encuesta-gracias"
            ref={doneHeading}
            tabIndex={-1}
            className="type-heading text-text m-0 outline-none"
          >
            {t('done.title')}
          </h2>
          <p className="type-body text-text-muted max-w-reading m-0">{t('done.body')}</p>
        </div>
        {nextLocked && (
          <div className="space-y-2">
            <p className="type-body text-text m-0">{t('done.next', { module: nextLocked.name })}</p>
            <UnlockRequestButton
              enrollmentId={enrollmentId}
              moduleId={nextLocked.id}
              moduleName={nextLocked.name}
              requestedAt={nextLocked.requestedAt}
            />
          </div>
        )}
        <Button asChild variant={nextLocked ? 'quiet' : 'primary'}>
          <Link href={backHref as Route}>
            {t('done.back')}
            <ArrowRight aria-hidden className="size-4 shrink-0" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <ConversationalForm
      steps={steps}
      jumpTo={jumpTo}
      onSubmit={() => void submit()}
      finale={{
        section: t('sections.send'),
        prompt: t('ready', { name: firstName }),
        content: (
          <div className="space-y-4">
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              {t('submit')}
            </Button>
          </div>
        ),
      }}
    />
  );
}
