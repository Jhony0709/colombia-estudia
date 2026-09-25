'use client';

/**
 * Crear un tema o una evaluación.
 * SSOT: reference/02-api/endpoints.md (Content), decisión 18/9 (sin importación).
 *
 * Existe porque el 18/9 se decidió que no habría importación desde LearnDash. Hasta
 * entonces los 110 temas iban a entrar en bloque y nadie iba a crear uno a mano; desde
 * entonces, esta es **la única puerta** por la que entra contenido al programa.
 *
 * Crear lleva directamente al editor: quien crea un tema quiere escribirlo, y dejarlo en una
 * lista para que lo busque es hacerle dar un rodeo por donde acaba de pasar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { apiErrorText } from '@/lib/http/api-error-text';

export interface ModuleOption {
  id: string;
  name: string;
  programId: string;
  programName: string;
}

/** Un tema del que una evaluación puede ser examen (20/9). */
export interface LessonOption {
  id: string;
  title: string;
  moduleId: string;
  position: number;
}

export interface SubjectOption {
  id: string;
  name: string;
}

export interface ProgramOption {
  id: string;
  name: string;
}

function useCreate(path: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: unknown, goTo: (payload: Record<string, string>) => string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(apiErrorText(payload, 'No se pudo crear. Inténtalo otra vez.'));
        return;
      }

      router.push(goTo((payload.data ?? payload) as Record<string, string>));
    } catch {
      setError('No se pudo crear. Inténtalo otra vez.');
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, send };
}

export function CreateLessonForm({
  modules,
  subjects,
}: {
  modules: ModuleOption[];
  subjects: SubjectOption[];
}) {
  const t = useTranslations('content');
  const { busy, error, send } = useCreate('/api/content/lessons');

  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [requiresSubmission, setRequiresSubmission] = useState(false);

  // Sin módulos o sin asignaturas no se puede crear un tema, y decirlo es más útil que
  // enseñar un formulario con dos listas vacías.
  if (modules.length === 0 || subjects.length === 0) {
    return <Alert severity="warning">{t('createNeedsCurriculum')}</Alert>;
  }

  return (
    <form
      className="max-w-reading space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send(
          { moduleId, subjectId, title, requiresSubmission },
          (payload) => `/contenido/temas/${payload.code}`
        );
      }}
    >
      {error !== null && <Alert severity="error">{error}</Alert>}

      <FormField label={t('formTitle')} name="lessonTitle" required>
        <FormInput
          name="lessonTitle"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormField>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-1">
          <FormField label={t('formModule')} name="moduleId" required>
            <FormSelect
              name="moduleId"
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {`${m.programName} · ${m.name}`}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
        <div className="min-w-0 flex-1">
          <FormField label={t('formSubject')} name="subjectId" required>
            <FormSelect
              name="subjectId"
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
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input
          id="requiereEntrega"
          type="checkbox"
          checked={requiresSubmission}
          onChange={(event) => setRequiresSubmission(event.target.checked)}
          className="border-border text-accent-base focus:ring-accent-base mt-0.5 h-6 w-6 rounded"
        />
        <label htmlFor="requiereEntrega" className="type-body text-text max-w-reading">
          {t('formRequiresSubmission')}
        </label>
      </div>

      <Button type="submit" loading={busy} disabled={title.trim() === ''}>
        {t('createLesson')}
      </Button>
    </form>
  );
}

export function CreateAssessmentForm({
  programs,
  modules,
  lessons,
}: {
  programs: ProgramOption[];
  modules: ModuleOption[];
  lessons: LessonOption[];
}) {
  const t = useTranslations('content');
  const { busy, error, send } = useCreate('/api/content/assessments');

  const [title, setTitle] = useState('');
  const [programId, setProgramId] = useState(programs[0]?.id ?? '');
  const [kind, setKind] = useState<'DIAGNOSTIC' | 'SUBJECT' | 'FINAL'>('SUBJECT');
  const [moduleId, setModuleId] = useState('');
  const [lessonId, setLessonId] = useState('');

  if (programs.length === 0) {
    return <Alert severity="warning">{t('createNeedsProgram')}</Alert>;
  }

  // Una diagnóstica es del programa entero: pedirle un módulo sería pedir un dato que no
  // significa nada.
  const needsModule = kind !== 'DIAGNOSTIC';
  const modulesOfProgram = modules.filter((m) => m.programId === programId);
  // El tema del que es examen (20/9): solo los del módulo elegido, en su orden. Sin tema,
  // el examen va al final del módulo.
  const lessonsOfModule = lessons
    .filter((l) => l.moduleId === moduleId)
    .sort((a, b) => a.position - b.position);

  return (
    <form
      className="max-w-reading space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send(
          {
            programId,
            kind,
            title,
            moduleId: needsModule && moduleId !== '' ? moduleId : null,
            lessonId: needsModule && moduleId !== '' && lessonId !== '' ? lessonId : null,
          },
          (payload) => `/contenido/examenes/${payload.code}`
        );
      }}
    >
      {error !== null && <Alert severity="error">{error}</Alert>}

      <FormField label={t('formTitle')} name="assessmentTitle" required>
        <FormInput
          name="assessmentTitle"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormField>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-1">
          <FormField label={t('formProgram')} name="programId" required>
            <FormSelect
              name="programId"
              value={programId}
              onChange={(event) => {
                setProgramId(event.target.value);
                setModuleId('');
              }}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
        <div className="min-w-0 flex-1">
          <FormField label={t('formKind')} name="kind" required>
            <FormSelect
              name="kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL')
              }
            >
              {(['DIAGNOSTIC', 'SUBJECT', 'FINAL'] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`kind.${value}`)}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
        {needsModule && (
          <div className="min-w-0 flex-1">
            <FormField label={t('formModule')} name="assessmentModuleId">
              <FormSelect
                name="assessmentModuleId"
                value={moduleId}
                onChange={(event) => {
                  setModuleId(event.target.value);
                  setLessonId('');
                }}
              >
                <option value="">{t('formNoModule')}</option>
                {modulesOfProgram.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
        )}
      </div>

      {/* En su propia fila: cuatro selects en una no caben, y este lleva texto de ayuda. */}
      {needsModule && moduleId !== '' && (
        <FormField label={t('formLesson')} name="assessmentLessonId" hint={t('formLessonHint')}>
          <FormSelect
            name="assessmentLessonId"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
          >
            <option value="">{t('formNoLesson')}</option>
            {lessonsOfModule.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </FormSelect>
        </FormField>
      )}

      <Button type="submit" loading={busy} disabled={title.trim() === ''}>
        {t('createAssessment')}
      </Button>
    </form>
  );
}
