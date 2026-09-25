'use client';

/**
 * El árbol del programa y las puertas para crear (23/9).
 *
 * Cliente porque el «+ Añadir contenido» abre un menú y una hoja de alta con estado; el
 * árbol en sí es una lista de enlaces. Cada módulo es un bloque; dentro, cada tema con sus
 * exámenes colgando con una línea, en el orden exacto de la ruta del estudiante (mismo
 * `sortItems`). Las cosas se crean con lo que el contexto ya sabe: el módulo, y el tema si
 * el examen es de un tema.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  FileUp,
  Plus,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type {
  BuilderForm,
  BuilderItem,
  BuilderModule,
  ProgramBuilder,
} from '@/features/content/server/builder.service';
import { Badge, type BadgeVariant } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { EmptyState } from '@/components/molecules/empty-state';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import { Sheet } from '@/components/organisms/sheet';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

const FORM_ICONS: Record<BuilderForm, LucideIcon> = {
  VIDEO: Video,
  MARKDOWN: BookOpen,
  SUBMISSION: FileUp,
  ASSESSMENT: ClipboardCheck,
};

/** Qué se va a crear y dónde: el contexto que el formulario ya no pregunta. */
type Draft =
  | { kind: 'LESSON'; module: BuilderModule }
  | { kind: 'ASSESSMENT'; module: BuilderModule; lesson: BuilderItem | null };

export function ProgramBuilderView({ builder }: { builder: ProgramBuilder }) {
  const t = useTranslations('builder');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subjectDefault, setSubjectDefault] = useState<string | null>(null);

  // La asignatura que ya usa el módulo (la más repetida) va prellenada: en un módulo de
  // Matemáticas el siguiente tema casi siempre es de Matemáticas.
  const open = (next: Draft) => {
    const counts = new Map<string, number>();
    for (const item of next.module.items) {
      if (item.subjectId) counts.set(item.subjectId, (counts.get(item.subjectId) ?? 0) + 1);
    }
    const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null];
    setSubjectDefault(best);
    setDraft(next);
  };

  if (builder.modules.length === 0) {
    return (
      <EmptyState
        title={t('noModulesTitle')}
        description={t('noModulesHint')}
        action={
          <Button asChild variant="secondary">
            <Link href="/contenido/programas">{t('manageModules')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-4">
        {builder.modules.map((module) => (
          <li key={module.id}>
            <ModuleBlock module={module} onAdd={open} />
          </li>
        ))}
      </ol>

      {builder.programAssessments.length > 0 && (
        <section
          aria-labelledby="builder-program-assessments"
          className="border-border rounded-card border p-4"
        >
          <h2 id="builder-program-assessments" className="type-subheading text-text">
            {t('programAssessments')}
          </h2>
          <p className="type-caption text-text-muted mb-3">{t('programAssessmentsHint')}</p>
          <ul className="space-y-2">
            {builder.programAssessments.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} nested={false} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="type-caption text-text-muted">
        <Link href="/contenido/programas" className="text-text-link underline">
          {t('manageModules')}
        </Link>
      </p>

      <CreateSheet
        key={draft ? `${draft.kind}:${draft.module.id}:${subjectDefault ?? ''}` : 'closed'}
        draft={draft}
        programId={builder.program.id}
        subjects={builder.subjects}
        subjectDefault={subjectDefault}
        onClose={() => setDraft(null)}
      />
    </div>
  );
}

// ─────────────────────────── módulo ───────────────────────────

function ModuleBlock({ module, onAdd }: { module: BuilderModule; onAdd: (draft: Draft) => void }) {
  const t = useTranslations('builder');
  const { published, total } = module.readiness;

  return (
    <section
      aria-labelledby={`builder-module-${module.id}`}
      className="border-border bg-surface-base rounded-card border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="type-overline text-text-muted uppercase">
            {t('moduleN', { position: module.position })}
          </p>
          <h2 id={`builder-module-${module.id}`} className="type-subheading text-text">
            {module.name}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="type-caption text-text-muted">
            {total === 0 ? t('moduleEmpty') : t('moduleReadiness', { published, total })}
          </span>
          <AddMenu module={module} onAdd={onAdd} />
        </div>
      </div>

      {module.items.length > 0 && (
        <ol className="mt-4 space-y-2">
          {module.items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} nested={item.kind === 'ASSESSMENT' && item.lessonId !== null} />
              {item.kind === 'LESSON' && (
                <AddExamHint module={module} lesson={item} onAdd={onAdd} />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** «+ Añadir contenido» del módulo: tema, o examen del módulo (al final). */
function AddMenu({ module, onAdd }: { module: BuilderModule; onAdd: (draft: Draft) => void }) {
  const t = useTranslations('builder');
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button variant="secondary">
          <Plus aria-hidden className="size-4" />
          {t('addContent')}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label={t('addContentIn', { module: module.name })}>
        <DropdownItem
          startContent={<BookOpen />}
          description={t('addLessonHint')}
          onSelect={() => onAdd({ kind: 'LESSON', module })}
        >
          {t('addLesson')}
        </DropdownItem>
        <DropdownItem
          startContent={<ClipboardCheck />}
          description={t('addModuleExamHint')}
          onSelect={() => onAdd({ kind: 'ASSESSMENT', module, lesson: null })}
        >
          {t('addModuleExam')}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

/**
 * Bajo cada tema, la puerta discreta para colgarle un examen. Solo si todavía no tiene: la
 * regla del cliente es un examen por tema, y un segundo enlace confundiría.
 */
function AddExamHint({
  module,
  lesson,
  onAdd,
}: {
  module: BuilderModule;
  lesson: BuilderItem;
  onAdd: (draft: Draft) => void;
}) {
  const t = useTranslations('builder');
  const hasExam = module.items.some(
    (item) => item.kind === 'ASSESSMENT' && item.lessonId === lesson.id
  );
  if (hasExam) return null;
  return (
    <div className="border-border-muted ml-5 border-l-2 pl-4">
      <button
        type="button"
        onClick={() => onAdd({ kind: 'ASSESSMENT', module, lesson })}
        className="type-caption text-text-link min-h-touch inline-flex items-center gap-1 underline"
      >
        <Plus aria-hidden className="size-3" />
        {t('addLessonExam')}
      </button>
    </div>
  );
}

// ─────────────────────────── ítem ───────────────────────────

function statusBadge(item: BuilderItem, t: ReturnType<typeof useTranslations>) {
  if (item.latestStatus === null) {
    return { variant: 'neutral' as BadgeVariant, label: t('status.none') };
  }
  if (item.latestStatus === 'PUBLISHED') {
    return {
      variant: 'success' as BadgeVariant,
      label: t('status.published', { number: item.latestNumber ?? 1 }),
    };
  }
  if (item.hasPublished) {
    return {
      variant: 'info' as BadgeVariant,
      label: t('status.draftOverPublished', { number: item.latestNumber ?? 1 }),
    };
  }
  return {
    variant: 'warning' as BadgeVariant,
    label: t('status.draft', { number: item.latestNumber ?? 1 }),
  };
}

function ItemRow({ item, nested }: { item: BuilderItem; nested: boolean }) {
  const t = useTranslations('builder');
  const Icon = FORM_ICONS[item.form];
  const href =
    item.kind === 'LESSON' ? `/contenido/temas/${item.code}` : `/contenido/examenes/${item.code}`;
  const badge = statusBadge(item, t);

  const meta = [
    t(`form.${item.form}`),
    item.estimatedMinutes ? t('minutes', { count: item.estimatedMinutes }) : null,
    item.subjectName,
    item.questionCount !== null ? t('questions', { count: item.questionCount }) : null,
    item.assessmentKind ? t(`assessmentKind.${item.assessmentKind}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn(nested && 'border-border-muted ml-5 border-l-2 pl-4')}>
      <Link
        href={href}
        className="border-border hover:bg-surface-sunken rounded-control min-h-touch flex items-center gap-3 border p-3"
      >
        {item.hasPublished && item.latestStatus === 'PUBLISHED' ? (
          <CircleCheck aria-hidden className="text-status-success-base size-5 shrink-0" />
        ) : (
          <Icon aria-hidden className="text-text-muted size-5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="type-body-emphasis text-text-link block underline">{item.title}</span>
          <span className="type-caption text-text-muted block">{meta}</span>
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </Link>
    </div>
  );
}

// ─────────────────────────── alta ───────────────────────────

/**
 * La hoja de alta: lo mínimo que el sistema no sabe. Un tema: título, asignatura y cómo se
 * completa. Un examen: título y tipo. Programa, módulo y tema vienen del contexto y se
 * enseñan, no se preguntan. Crear lleva al editor, como desde las listas.
 */
function CreateSheet({
  draft,
  programId,
  subjects,
  subjectDefault,
  onClose,
}: {
  draft: Draft | null;
  programId: string;
  subjects: ProgramBuilder['subjects'];
  subjectDefault: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('builder');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjectDefault ?? subjects[0]?.id ?? '');
  const [completion, setCompletion] = useState<'READ' | 'SUBMISSION'>('READ');
  const [kind, setKind] = useState<'SUBJECT' | 'FINAL'>('SUBJECT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setCompletion('READ');
    setKind('SUBJECT');
    setError(null);
  };

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const isLesson = draft.kind === 'LESSON';
      const res = await fetch(isLesson ? '/api/content/lessons' : '/api/content/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isLesson
            ? {
                moduleId: draft.module.id,
                subjectId,
                title,
                requiresSubmission: completion === 'SUBMISSION',
              }
            : {
                programId,
                moduleId: draft.module.id,
                lessonId: draft.lesson?.id ?? null,
                kind,
                title,
              }
        ),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(apiErrorText(payload, t('createError')));
        return;
      }
      const data = (payload.data ?? payload) as Record<string, string>;
      reset();
      onClose();
      router.push(isLesson ? `/contenido/temas/${data.code}` : `/contenido/examenes/${data.code}`);
    } catch {
      setError(t('createError'));
    } finally {
      setBusy(false);
    }
  };

  const isLesson = draft?.kind === 'LESSON';
  const context =
    draft === null
      ? ''
      : draft.kind === 'LESSON' || draft.lesson === null
        ? t('contextModule', { module: draft.module.name })
        : t('contextLesson', { module: draft.module.name, lesson: draft.lesson.title });

  return (
    <Sheet
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
      title={isLesson ? t('newLessonTitle') : t('newExamTitle')}
      description={context}
    >
      {draft && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {error !== null && <Alert severity="error">{error}</Alert>}

          <FormField label={t('fieldTitle')} name="builderTitle" required>
            <FormInput
              name="builderTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoComplete="off"
            />
          </FormField>

          {isLesson ? (
            <>
              <FormField label={t('fieldSubject')} name="builderSubject" required>
                <FormSelect
                  name="builderSubject"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              {subjects.length === 0 && <Alert severity="warning">{t('noSubjects')}</Alert>}

              {/* «¿Cómo se completa?» en vez de la casilla técnica: dos opciones, que son las
                  dos formas que existen (`lesson-completion.ts`); el examen es el paso
                  siguiente, no una forma de completar el tema. */}
              <fieldset className="space-y-2">
                <legend className="type-label text-text mb-1">{t('completionQuestion')}</legend>
                {(
                  [
                    { value: 'READ', label: t('completion.READ'), hint: t('completion.READHint') },
                    {
                      value: 'SUBMISSION',
                      label: t('completion.SUBMISSION'),
                      hint: t('completion.SUBMISSIONHint'),
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'rounded-control flex cursor-pointer items-start gap-3 border p-3',
                      completion === option.value
                        ? 'border-accent-base bg-surface-sunken'
                        : 'border-border'
                    )}
                  >
                    <input
                      type="radio"
                      name="builderCompletion"
                      value={option.value}
                      checked={completion === option.value}
                      onChange={() => setCompletion(option.value)}
                      className="mt-1"
                    />
                    {/* El texto a dos niveles del `label`: `jsx-a11y/label-has-associated-control` no mira más hondo. */}
                    <span className="type-body text-text block">
                      {option.label}
                      <span className="type-caption text-text-muted block">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          ) : (
            <FormField label={t('fieldKind')} name="builderKind" required>
              <FormSelect
                name="builderKind"
                value={kind}
                onChange={(event) => setKind(event.target.value as 'SUBJECT' | 'FINAL')}
              >
                <option value="SUBJECT">{t('assessmentKind.SUBJECT')}</option>
                <option value="FINAL">{t('assessmentKind.FINAL')}</option>
              </FormSelect>
            </FormField>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="quiet" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={title.trim() === '' || (isLesson && subjectId === '')}
            >
              {isLesson ? t('createLesson') : t('createExam')}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
