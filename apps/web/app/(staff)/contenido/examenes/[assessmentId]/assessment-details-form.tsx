'use client';

/**
 * Los datos del examen: título, tipo, componente, tema del que es examen, asignatura y
 * objetivo (25/9, Jhonny: «los exámenes deben poderse editar una vez creados»).
 * SSOT: `updateAssessmentDetails` (`features/content/server/assessments.service.ts`).
 *
 * Es `LessonDetailsForm` para exámenes: al principio y plegado, porque quien abre el editor
 * viene a escribir preguntas y corregir el tipo es la excepción. Con una versión publicada,
 * componente y tema se cierran y se dice por qué: los dos deciden dónde cae el examen en la
 * ruta que las cohortes están recorriendo.
 */

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { useToast } from '@/components/organisms/toaster';
import { apiErrorText } from '@/lib/http/api-error-text';
import type { AssessmentKind } from '@/features/content/server/assessments.service';

export interface AssessmentModuleChoice {
  id: string;
  name: string;
}

export interface AssessmentLessonChoice {
  id: string;
  title: string;
  moduleId: string;
  position: number;
}

export interface AssessmentSubjectChoice {
  id: string;
  name: string;
}

const KINDS: readonly AssessmentKind[] = ['DIAGNOSTIC', 'SUBJECT', 'FINAL'];

export function AssessmentDetailsForm({
  assessmentId,
  modules,
  lessons,
  subjects,
  initial,
  hasPublished,
}: {
  assessmentId: string;
  /** Solo los componentes del programa del examen: cambiar de programa no está permitido. */
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
  hasPublished: boolean;
}) {
  const t = useTranslations('assessmentEditor');
  const tf = useTranslations('content');
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState<AssessmentKind>(initial.kind);
  const [moduleId, setModuleId] = useState(initial.moduleId ?? '');
  const [lessonId, setLessonId] = useState(initial.lessonId ?? '');
  const [subjectId, setSubjectId] = useState(initial.subjectId ?? '');
  const [objective, setObjective] = useState(initial.learningObjective ?? '');
  const [busy, setBusy] = useState(false);

  const needsModule = kind !== 'DIAGNOSTIC';
  const lessonsOfModule = lessons
    .filter((lesson) => lesson.moduleId === moduleId)
    .sort((a, b) => a.position - b.position);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/content/assessments/${assessmentId}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          kind,
          moduleId: needsModule && moduleId !== '' ? moduleId : null,
          lessonId: needsModule && moduleId !== '' && lessonId !== '' ? lessonId : null,
          subjectId: subjectId === '' ? null : subjectId,
          learningObjective: objective,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast({ severity: 'error', title: apiErrorText(payload, t('detailsError')) });
        return;
      }

      toast({ severity: 'success', title: t('detailsSaved') });
      // La cabecera trae el título y el tipo desde el servidor.
      router.refresh();
    } catch {
      toast({ severity: 'error', title: t('detailsError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <details className="group">
        <summary className="type-subheading text-text min-h-control flex cursor-pointer items-center">
          <ChevronRight
            aria-hidden="true"
            className="duration-fast ease-standard mr-2 h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
          />
          {t('detailsTitle')}
        </summary>
        <div className="max-w-reading mt-4 space-y-4">
          <FormField label={t('detailsFieldTitle')} name="assessmentTitle" required>
            <FormInput
              name="assessmentTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField label={tf('formKind')} name="assessmentKind" required>
            <FormSelect
              name="assessmentKind"
              value={kind}
              onChange={(event) => setKind(event.target.value as AssessmentKind)}
            >
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`kind.${value}`)}
                </option>
              ))}
            </FormSelect>
          </FormField>

          {needsModule && (
            <FormField
              label={tf('formModule')}
              name="assessmentModuleId"
              hint={hasPublished ? t('detailsLockedPublished') : undefined}
            >
              <FormSelect
                name="assessmentModuleId"
                value={moduleId}
                disabled={hasPublished}
                onChange={(event) => {
                  setModuleId(event.target.value);
                  setLessonId('');
                }}
              >
                <option value="">{tf('formNoModule')}</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          )}

          {needsModule && moduleId !== '' && (
            <FormField
              label={tf('formLesson')}
              name="assessmentLessonId"
              hint={hasPublished ? t('detailsLockedPublished') : tf('formLessonHint')}
            >
              <FormSelect
                name="assessmentLessonId"
                value={lessonId}
                disabled={hasPublished}
                onChange={(event) => setLessonId(event.target.value)}
              >
                <option value="">{tf('formNoLesson')}</option>
                {lessonsOfModule.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          )}

          <FormField label={t('detailsFieldSubject')} name="assessmentSubjectId">
            <FormSelect
              name="assessmentSubjectId"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">{t('detailsNoSubject')}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormField
            label={t('detailsFieldObjective')}
            name="assessmentObjective"
            hint={t('detailsObjectiveHint')}
          >
            <FormInput
              name="assessmentObjective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
            />
          </FormField>

          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={title.trim() === ''}
            onClick={save}
          >
            {t('detailsSave')}
          </Button>
        </div>
      </details>
    </Card>
  );
}
