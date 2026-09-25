'use client';

/**
 * El editor de una evaluación: las preguntas, las respuestas correctas cuando se piden, las
 * reglas del intento y la publicación.
 * SSOT: plan/07-contenido-y-migracion.md:40-51, revisión de UX del 18/9.
 *
 * Tres decisiones, y las tres son correcciones de cómo estaba esta mañana:
 *
 * 1. **Se guarda de una sola manera.** Había tres a la vez —autoguardado a los 5 s, «Guardar
 *    ahora» dentro de las reglas del intento, y «Guardar la clave», que era la única y no
 *    autoguardaba— así que marcar las respuestas y cerrar la pestaña las perdía en silencio.
 *    Ahora todo lo de esta pantalla entra por `saveAll`, y el botón solo adelanta el reloj.
 *
 * 2. **Las respuestas no se piden hasta que alguien las pide, pero se marcan donde están.**
 *    Mientras `answers` sea `null` el solucionario no ha llegado a esta pantalla: no está en
 *    el HTML, ni en una captura, ni en el historial. Eso es lo que protege plan/07:48; lo que
 *    ya no se cumple es su «panel aparte, visualmente separado», y es deliberado.
 *
 * 3. **El botón de publicar existe siempre.** Antes se ocultaba mientras hubiera errores y el
 *    texto decía «arréglalos y el botón aparece»: para entender un botón hay que verlo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms/badge';
import { PageHeader } from '@/components/templates/page';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { PageSection } from '@/components/templates/page';
import { Dialog, DialogClose } from '@/components/organisms/dialog';
import {
  AssessmentDetailsForm,
  type AssessmentLessonChoice,
  type AssessmentModuleChoice,
  type AssessmentSubjectChoice,
} from './assessment-details-form';
import type { AssessmentKind } from '@/features/content/server/assessments.service';
import { issueText } from '@/lib/content/issue-text';
import { apiErrorText } from '@/lib/http/api-error-text';
import { QuestionsBuilder, type QuestionIssue } from './questions-builder';
import {
  parseAnswerKey,
  parseDraft,
  serializeAnswerKey,
  serializeDraft,
  type AnswerKeyDraft,
  type AssessmentDraft,
} from './question-model';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { pendingChecks, ReadinessPanel, type ReadinessCheck } from '../../readiness-panel';
import { PublishedLine } from '../../published-line';
import { EditorLayout } from '../../editor-layout';
import type { AssessmentReadiness } from '@/features/content/server/readiness.service';

interface Issue {
  rule?: string;
  message: string;
  fix?: string;
  path?: string;
}

interface Validation {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

const AUTOSAVE_MS = 5000;

/**
 * De la ruta de un aviso a la pregunta que lo causa.
 *
 * El dominio ya la emite: `questions.p4.text`, `answerKey.p4.correct` (publish-validation.ts:
 * 523, 585, 651, 685…). Las reglas que no hablan de una pregunta concreta traen `questions`
 * a secas o nada, y esas se quedan en la lista de avisos general.
 */
const questionCodeOf = (issue: Issue): string | null =>
  /^(?:questions|answerKey)\.([^.]+)/.exec(issue.path ?? '')?.[1] ?? null;

export function AssessmentEditor({
  assessmentId,
  versionId,
  initialContent,
  initialMaxAttempts,
  initialTimeLimitMinutes,
  initialPassPercent,
  initialReviewPolicy,
  canPublish,
  header,
  details,
  readiness,
}: {
  assessmentId: string;
  versionId: string;
  /** Lo que la cabecera necesita: la pinta este componente porque sus acciones dependen del estado. */
  header: {
    code: string;
    title: string;
    kindLabel: string;
    number: number;
    hasPublished: boolean;
  };
  /** Lo que «Datos del examen» necesita (25/9). */
  details: {
    modules: AssessmentModuleChoice[];
    lessons: AssessmentLessonChoice[];
    subjects: AssessmentSubjectChoice[];
    initial: {
      title: string;
      kind: AssessmentKind;
      moduleId: string | null;
      lessonId: string | null;
      subjectId: string | null;
      learningObjective: string | null;
    };
  };
  initialContent: string;
  initialMaxAttempts: number;
  initialTimeLimitMinutes: number | null;
  initialPassPercent: number | null;
  initialReviewPolicy: string;
  canPublish: boolean;
  /** Dónde está el examen en la ruta, su versión publicada y las cohortes abiertas. */
  readiness: AssessmentReadiness | null;
}) {
  const t = useTranslations('assessmentEditor');
  const tc = useTranslations('crumbs');
  const ti = useTranslations('issues');
  const [confirming, setConfirming] = useState(false);

  // Lo guardado puede no tener la forma que el formulario sabe enseñar: contenido de antes
  // del constructor, o escrito a mano. En ese caso NO se enseña un formulario vacío —guardarlo
  // borraría lo que había— sino el texto tal cual, en solo lectura, y se dice qué pasa.
  const parsed = useMemo(() => parseDraft(initialContent), [initialContent]);
  const [draft, setDraft] = useState<AssessmentDraft>(
    parsed.ok ? parsed.draft : { instructions: '', questions: [] }
  );
  const [maxAttempts, setMaxAttempts] = useState(String(initialMaxAttempts));
  const [timeLimit, setTimeLimit] = useState(
    initialTimeLimitMinutes === null ? '' : String(initialTimeLimitMinutes)
  );
  const [passPercent, setPassPercent] = useState(
    initialPassPercent === null ? '' : String(initialPassPercent)
  );
  const [reviewPolicy, setReviewPolicy] = useState(initialReviewPolicy);

  /** `null` = todavía no se han pedido. El examen resuelto no está en esta pantalla. */
  const [answers, setAnswers] = useState<AnswerKeyDraft | null>(null);
  const [revealing, setRevealing] = useState(false);

  const [contentDirty, setContentDirty] = useState(false);
  const [answersDirty, setAnswersDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const base = `/api/content/assessments/${assessmentId}`;
  const dirty = contentDirty || answersDirty;

  // El guardado lee el estado del momento en que corre, no el de cuando se programó el
  // temporizador: sin esto, escribir durante los 5 s del autoguardado guarda lo anterior.
  const latest = useRef({ draft, maxAttempts, timeLimit, passPercent, reviewPolicy, answers });
  latest.current = { draft, maxAttempts, timeLimit, passPercent, reviewPolicy, answers };

  const validate = useCallback(async () => {
    const res = await fetch(`${base}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId }),
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { data?: Validation } & Partial<Validation>;
    setValidation((payload.data ?? payload) as Validation);
  }, [base, versionId]);

  /**
   * Todo lo de esta pantalla, en un solo sitio.
   *
   * Son dos peticiones porque son dos objetos por dos rutas —eso no se negocia—, pero para
   * quien la usa es un solo «guardar»: no hay forma de salvar la mitad.
   */
  const saveAll = useCallback(async (): Promise<boolean> => {
    const state = latest.current;
    const number = (value: string) => (value.trim() === '' ? null : Number(value));

    setSaving(true);
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          content: serializeDraft(state.draft),
          maxAttempts: Number(state.maxAttempts) || 1,
          timeLimitMinutes: number(state.timeLimit),
          passPercent: number(state.passPercent),
          reviewPolicy: state.reviewPolicy,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as unknown;
        setError(apiErrorText(payload, t('saveError')));
        return false;
      }
      setContentDirty(false);

      /*
        La ruta rechaza una clave vacía (`answer-key/route.ts:54`: «no puede quedar vacía»),
        así que no se envía cuando no hay nada marcado. Sin esto, mostrar las respuestas de
        una evaluación recién creada y tocar cualquier enunciado guardaba el contenido y
        acto seguido daba un error de guardado que no era cierto.

        La otra cara: desmarcar TODAS las respuestas de TODAS las preguntas no se guarda.
        No hay forma de vaciarla por esta API, y el validador marca entonces cada pregunta
        con «falta marcar la respuesta correcta», así que no se pierde en silencio.
      */
      const serializedKey =
        state.answers === null ? {} : serializeAnswerKey(state.answers, state.draft.questions);

      if (state.answers !== null && Object.keys(serializedKey).length > 0) {
        const keyRes = await fetch(`${base}/answer-key`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId, answerKey: serializedKey }),
        });

        if (!keyRes.ok) {
          const payload = (await keyRes.json().catch(() => null)) as unknown;
          setError(apiErrorText(payload, t('keySaveError')));
          return false;
        }
      }
      setAnswersDirty(false);

      setSavedAt(new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' }));
      setError(null);
      return true;
    } catch {
      setError(t('saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [base, t, versionId]);

  const saveAndValidate = useCallback(async () => {
    if (await saveAll()) await validate();
  }, [saveAll, validate]);

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void saveAndValidate(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, saveAndValidate]);

  useEffect(() => {
    void validate();
  }, [validate]);

  const reveal = async () => {
    setRevealing(true);
    setError(null);
    try {
      const res = await fetch(`${base}/answer-key?versionId=${versionId}`);
      if (!res.ok) {
        setError(t('keyLoadError'));
        return;
      }
      const payload = (await res.json()) as { data?: { answerKey?: unknown }; answerKey?: unknown };
      setAnswers(parseAnswerKey(payload.data?.answerKey ?? payload.answerKey ?? {}));
    } catch {
      setError(t('keyLoadError'));
    } finally {
      setRevealing(false);
    }
  };

  const hide = async () => {
    if (answersDirty) await saveAndValidate();
    // Se olvidan al ocultar: mientras estén ocultas, el examen resuelto no está en esta
    // pantalla ni en la memoria del navegador.
    setAnswers(null);
    setAnswersDirty(false);
  };

  const onPublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      if (dirty && !(await saveAll())) return;

      const res = await fetch(`${base}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const payload = (await res.json()) as {
        data?: { number?: number };
        number?: number;
        error?: { message?: string };
      };

      if (!res.ok) {
        setError(payload.error?.message ?? t('publishError'));
        void validate();
        return;
      }

      setPublished((payload.data?.number ?? payload.number) as number);
    } catch {
      setError(t('publishError'));
    } finally {
      setPublishing(false);
    }
  };

  const errors = useMemo(() => validation?.errors ?? [], [validation]);
  const warnings = useMemo(() => validation?.warnings ?? [], [validation]);

  /** Cada aviso, en la pregunta que lo causa. Los que no son de una pregunta, aparte. */
  const { issuesByQuestion, globalIssues, blockedNumbers, needsAnswers } = useMemo(() => {
    const byQuestion = new Map<string, QuestionIssue[]>();
    const global: Array<{ text: ReturnType<typeof issueText>; blocking: boolean }> = [];
    const numbers = new Set<number>();
    let answersNeeded = false;

    const index = new Map(draft.questions.map((question, i) => [question.code, i + 1]));

    for (const [list, blocking] of [
      [errors, true],
      [warnings, false],
    ] as const) {
      for (const issue of list) {
        const text = issueText(issue, ti);
        const code = questionCodeOf(issue);

        if (code === null || !index.has(code)) {
          global.push({ text, blocking });
          continue;
        }

        byQuestion.set(code, [
          ...(byQuestion.get(code) ?? []),
          { message: text.message, fix: text.fix, blocking },
        ]);

        if (blocking) {
          numbers.add(index.get(code) as number);
          if ((issue.path ?? '').startsWith('answerKey')) answersNeeded = true;
        }
      }
    }

    return {
      issuesByQuestion: byQuestion,
      globalIssues: global,
      blockedNumbers: [...numbers].sort((a, b) => a - b),
      needsAnswers: answersNeeded,
    };
  }, [draft.questions, errors, ti, warnings]);

  const blocked = validation === null || errors.length > 0 || !canPublish;
  const touchContent = () => setContentDirty(true);

  const status = saving
    ? t('saving')
    : dirty
      ? t('unsaved')
      : savedAt !== null
        ? t('savedAt', { time: savedAt })
        : t('noChanges');

  const checks = readinessChecks({
    t,
    readiness,
    questionCount: draft.questions.length,
    validation,
    maxAttempts,
    passPercent,
    publishedNumber: published ?? readiness?.published?.number ?? null,
  });
  const pendingCohorts = readiness?.cohorts.pending ?? [];

  return (
    <>
      <PageHeader
        overline={`${header.code} · ${header.kindLabel}`}
        title={header.title}
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('assessments'), href: '/contenido/examenes' },
              { label: header.title },
            ]}
          />
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={revealing}
              onClick={() => void (answers === null ? reveal() : hide())}
            >
              {answers === null ? t('showAnswers') : t('hideAnswers')}
            </Button>
            {/* Igual que en el tema: con permiso, el botón está siempre y responde; si algo
                impide publicar, abre la explicación. Sin permiso, la decisión es de otro. */}
            {canPublish && (
              <Button type="button" onClick={() => setConfirming(true)}>
                {t('publish')}
              </Button>
            )}
          </div>
        }
      />

      <div className="-mt-6 flex flex-wrap items-center gap-3">
        <Badge variant={header.hasPublished ? 'info' : 'neutral'}>
          {t('versionLine', { number: header.number })}
        </Badge>
        <p role="status" className="type-caption text-text-muted">
          {status}
        </p>
        <PublishedLine published={readiness?.published ?? null} />
      </div>

      {/* Ola 2 (23/9): la «Preparación» como columna fija en escritorio y bloque plegado en móvil. */}
      <EditorLayout
        rail={<ReadinessPanel id="preparacion" checks={checks} layout="rail" />}
        railSummary={t('readiness.summary', { pending: pendingChecks(checks) })}
      >
        {error !== null && <Alert severity="error">{error}</Alert>}
        {published !== null && (
          <Alert severity="success">{t('publishedOk', { number: published })}</Alert>
        )}

        {/* Los datos del examen, plegados (25/9): como «Datos del tema» en el editor del tema. */}
        <AssessmentDetailsForm
          assessmentId={assessmentId}
          modules={details.modules}
          lessons={details.lessons}
          subjects={details.subjects}
          initial={details.initial}
          hasPublished={header.hasPublished}
        />

        <PageSection
          id="preguntas"
          title={t('questionsLabel')}
          description={answers === null ? t('questionsHint') : t('questionsHintAnswers')}
        >
          {parsed.ok ? (
            <QuestionsBuilder
              draft={draft}
              onChange={(next) => {
                setDraft(next);
                touchContent();
              }}
              answers={answers}
              onAnswersChange={(next) => {
                setAnswers(next);
                setAnswersDirty(true);
              }}
              issuesByQuestion={issuesByQuestion}
            />
          ) : (
            <>
              <Alert severity="warning">{t('unreadableContent')}</Alert>
              <pre className="border-border bg-surface-sunken text-text type-caption rounded-card overflow-x-auto border p-3">
                {initialContent}
              </pre>
            </>
          )}
        </PageSection>

        <PageSection id="ajustes" title={t('settingsTitle')} card>
          <div className="flex flex-wrap gap-4">
            <NumberField
              label={t('maxAttempts')}
              value={maxAttempts}
              min={1}
              max={20}
              onChange={(v) => {
                setMaxAttempts(v);
                touchContent();
              }}
            />
            <NumberField
              label={t('timeLimit')}
              value={timeLimit}
              min={1}
              max={600}
              onChange={(v) => {
                setTimeLimit(v);
                touchContent();
              }}
            />
            <NumberField
              label={t('passPercent')}
              value={passPercent}
              min={0}
              max={100}
              onChange={(v) => {
                setPassPercent(v);
                touchContent();
              }}
            />
            <SelectField
              label={t('reviewPolicy')}
              value={reviewPolicy}
              options={['NONE', 'SCORE_ONLY', 'FULL_AFTER_GRADED', 'FULL_AFTER_DUE'].map(
                (value) => ({
                  value,
                  label: t(`policy.${value}`),
                })
              )}
              onChange={(v) => {
                setReviewPolicy(v);
                touchContent();
              }}
            />
          </div>
        </PageSection>

        {/* Los avisos que no son de una pregunta concreta, solo cuando los hay. */}
        {globalIssues.length > 0 && (
          <div id="examen-avisos">
            <PageSection id="avisos" title={t('issuesTitle')} card>
              {globalIssues.length > 0 && (
                <ul className="divide-border-muted -my-1 divide-y">
                  {globalIssues.map((issue, index) => (
                    <li key={index} className="space-y-1 py-3">
                      <p className="type-body-emphasis text-text">
                        {issue.blocking ? t('error') : t('warning')}
                      </p>
                      <p className="type-body text-text max-w-reading">{issue.text.message}</p>
                      {issue.text.fix !== null && (
                        <p className="type-caption text-text-muted max-w-reading">
                          {issue.text.fix}
                        </p>
                      )}
                      {issue.text.detail !== null && (
                        <p className="type-caption text-text-subtle max-w-reading">
                          {ti('detail', { detail: issue.text.detail })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PageSection>
          </div>
        )}
      </EditorLayout>

      {/* ── Publicar: un diálogo con lo que lo impide, o la confirmación ── */}
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        locked={publishing}
        title={t('publishTitle')}
        description={
          validation === null
            ? t('validating')
            : blocked
              ? !canPublish
                ? t('blockedCapability')
                : t('blockedErrors', { count: errors.length })
              : t('readyToPublish')
        }
        actions={
          validation !== null && !blocked ? (
            <>
              <DialogClose>
                <Button type="button" variant="quiet" disabled={publishing}>
                  {t('cancel')}
                </Button>
              </DialogClose>
              <Button
                type="button"
                loading={publishing}
                disabled={saving}
                onClick={() => void onPublish()}
              >
                {t('confirmPublish')}
              </Button>
            </>
          ) : (
            <DialogClose>
              <Button type="button" variant="quiet">
                {t('cancel')}
              </Button>
            </DialogClose>
          )
        }
      >
        {validation !== null && blocked && blockedNumbers.length > 0 && (
          <p className="type-body text-text-muted max-w-reading">
            {t('blockedInQuestions', { list: blockedNumbers.join(', ') })}{' '}
            {needsAnswers && answers === null && t('blockedAnswersHidden')}
          </p>
        )}
        {/* Igual que en el tema: publicar no cambia lo asignado; abre que las cohortes
            sin el examen puedan añadirlo. */}
        {validation !== null && !blocked && pendingCohorts.length > 0 && (
          <p className="type-body text-text-muted max-w-reading">
            {t('confirmPending', {
              count: pendingCohorts.length,
              list: pendingCohorts.map((cohort) => cohort.code).join(', '),
            })}
          </p>
        )}
      </Dialog>
    </>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="type-label text-text block">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border bg-surface-base text-text type-body min-h-touch rounded-control mt-1 block border px-3"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="type-label text-text block">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border bg-surface-base text-text type-body min-h-touch rounded-control mt-1 block border px-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Las comprobaciones del panel de preparación. `readiness` trae lo que sabe la base; las
 * preguntas, las reglas y los avisos se leen del estado porque cambian mientras se edita.
 */
function readinessChecks({
  t,
  readiness,
  questionCount,
  validation,
  maxAttempts,
  passPercent,
  publishedNumber,
}: {
  t: ReturnType<typeof useTranslations<'assessmentEditor'>>;
  readiness: AssessmentReadiness | null;
  questionCount: number;
  validation: Validation | null;
  maxAttempts: string;
  passPercent: string;
  publishedNumber: number | null;
}): ReadinessCheck[] {
  if (readiness === null) return [];

  const builder = `/contenido/programas/${readiness.program.id}` as const;
  const checks: ReadinessCheck[] = [];

  const place =
    readiness.lesson !== null
      ? t('readiness.routeOfLesson', { title: readiness.lesson.title })
      : readiness.module !== null
        ? t('readiness.routeOfModule')
        : t('readiness.routeOfProgram');
  checks.push({
    key: 'route',
    state: 'info',
    label: t('readiness.route'),
    detail:
      readiness.module !== null
        ? `${t('readiness.routeDetail', {
            program: readiness.program.name,
            position: readiness.module.position,
            module: readiness.module.name,
          })} · ${place}`
        : `${readiness.program.name} · ${place}`,
    href: builder,
    linkLabel: t('readiness.routeLink'),
  });

  checks.push({
    key: 'questions',
    state: questionCount === 0 ? 'todo' : 'ok',
    label: t('readiness.questions'),
    detail:
      questionCount === 0
        ? t('readiness.questionsNone')
        : t('readiness.questionsCount', { count: questionCount }),
  });

  const errors = validation?.errors.length ?? 0;
  const warnings = validation?.warnings.length ?? 0;
  checks.push({
    key: 'issues',
    state: validation === null ? 'todo' : errors > 0 ? 'warn' : 'ok',
    label: t('readiness.issues'),
    detail:
      validation === null
        ? t('readiness.issuesChecking')
        : errors > 0
          ? t('readiness.issuesErrors', { count: errors })
          : t('readiness.issuesOk', { warnings }),
  });

  const attempts = Number(maxAttempts);
  const pass = passPercent.trim() === '' ? null : Number(passPercent);
  const hasPass = pass !== null && Number.isFinite(pass);
  checks.push({
    key: 'rules',
    state: hasPass ? 'ok' : 'warn',
    label: t('readiness.rules'),
    detail: hasPass
      ? t('readiness.rulesOk', { attempts: Number.isFinite(attempts) ? attempts : 0, pass })
      : t('readiness.rulesNoPass'),
  });

  const { assigned, pending } = readiness.cohorts;
  const cohortsDetail =
    assigned === 0 && pending.length === 0
      ? t('readiness.cohortsNone')
      : [
          assigned > 0 ? t('readiness.cohortsAssigned', { count: assigned }) : null,
          pending.length > 0 ? t('readiness.cohortsPending', { count: pending.length }) : null,
        ]
          .filter((part) => part !== null)
          .join(' · ');
  checks.push({
    key: 'publish',
    state: publishedNumber === null ? 'todo' : 'ok',
    label: t('readiness.publish'),
    detail: `${
      publishedNumber === null
        ? t('readiness.publishNone')
        : t('readiness.publishOk', { number: publishedNumber })
    } · ${cohortsDetail}`,
  });

  return checks;
}
