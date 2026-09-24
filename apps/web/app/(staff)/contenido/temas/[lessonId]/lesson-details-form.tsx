'use client';

/**
 * Los datos del tema: título, objetivo, asignatura, módulo y forma de completado.
 * SSOT: revisión de UX del 18/9 («lo que se crea no se puede corregir»).
 *
 * Hasta hoy estos cinco campos se fijaban al crear el tema y no se podían tocar nunca más.
 * Un error de tipeo en un título era permanente, y el objetivo de aprendizaje —que el player
 * enseña bajo el título— no tenía formulario en ninguna parte: era un campo muerto.
 *
 * Va plegado y debajo del editor a propósito: quien abre esta pantalla viene a escribir el
 * tema, no a renombrarlo. Corregir los datos es la excepción, y una excepción no ocupa la
 * mitad de la pantalla.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiErrorText } from '@/lib/http/api-error-text';
import { Button } from '@/components/atoms/button';
import { useToast } from '@/components/organisms/toaster';
import { Card } from '@/components/atoms/card';
import { ChevronRight } from 'lucide-react';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { DeleteLessonDialog } from './delete-lesson-dialog';

export interface ModuleChoice {
  id: string;
  name: string;
  programName: string;
}

export interface SubjectChoice {
  id: string;
  name: string;
}

export function LessonDetailsForm({
  lessonId,
  modules,
  subjects,
  initial,
  hasPublished,
  usage,
}: {
  lessonId: string;
  modules: ModuleChoice[];
  subjects: SubjectChoice[];
  initial: {
    title: string;
    learningObjective: string | null;
    moduleId: string;
    subjectId: string;
    requiresSubmission: boolean;
  };
  hasPublished: boolean;
  /** Dónde se usa el tema; decide si «Eliminar» se ofrece (24/9). */
  usage: { assignments: number; assessments: number; versions: number };
}) {
  const t = useTranslations('editor');
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [objective, setObjective] = useState(initial.learningObjective ?? '');
  const [moduleId, setModuleId] = useState(initial.moduleId);
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [requiresSubmission, setRequiresSubmission] = useState(initial.requiresSubmission);

  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const [archiving, setArchiving] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/content/lessons/${lessonId}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          learningObjective: objective,
          moduleId,
          subjectId,
          requiresSubmission,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast({ severity: 'error', title: apiErrorText(payload, t('detailsError')) });
        return;
      }

      toast({ severity: 'success', title: t('detailsSaved') });
      // La cabecera de la página trae el título y la asignatura desde el servidor: sin esto
      // el usuario guardaría un título nuevo y seguiría leyendo el viejo arriba.
      router.refresh();
    } catch {
      toast({ severity: 'error', title: t('detailsError') });
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/content/lessons/${lessonId}/archive`, { method: 'POST' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast({ severity: 'error', title: payload?.error?.message ?? t('archiveError') });
        return;
      }
      router.push('/contenido');
    } catch {
      toast({ severity: 'error', title: t('archiveError') });
    } finally {
      setBusy(false);
    }
  };

  // Al principio y plegado (19/9, Jhonny): es lo primero que se ve —de qué tema es esto— y lo
  // que menos veces se toca, así que va arriba y cerrado. El `summary` en `flex` pierde el
  // marcador nativo; el chevrón lo devuelve.
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
        {/* Los campos a ancho de lectura: un título en 1024 px es una línea que el ojo recorre
          entera para volver al principio. */}
        <div className="max-w-reading mt-4 space-y-4">
          <FormField label={t('detailsFieldTitle')} name="lessonTitle" required>
            <FormInput
              name="lessonTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField
            label={t('detailsFieldObjective')}
            name="learningObjective"
            hint={t('detailsObjectiveHint')}
          >
            <FormInput
              name="learningObjective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
            />
          </FormField>

          <FormField label={t('detailsFieldSubject')} name="subjectId">
            <FormSelect
              name="subjectId"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </FormSelect>
          </FormField>

          {/*
          Módulo y forma de completado se cierran en cuanto hay una versión publicada, y se
          dice por qué. Un control deshabilitado sin explicación se lee como un fallo.
        */}
          <FormField
            label={t('detailsFieldModule')}
            name="moduleId"
            hint={hasPublished ? t('detailsLockedPublished') : undefined}
          >
            <FormSelect
              name="moduleId"
              value={moduleId}
              disabled={hasPublished}
              onChange={(event) => setModuleId(event.target.value)}
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.programName} · {module.name}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <div className="flex items-start gap-2">
            <input
              id="detalles-entrega"
              type="checkbox"
              checked={requiresSubmission}
              disabled={hasPublished}
              onChange={(event) => setRequiresSubmission(event.target.checked)}
              className="border-border text-accent-base focus:ring-accent-base mt-0.5 h-6 w-6 rounded"
            />
            <label htmlFor="detalles-entrega" className="type-body text-text max-w-reading">
              {t('detailsRequiresSubmission')}
              {hasPublished && (
                <span className="type-caption text-text-muted block">
                  {t('detailsLockedPublished')}
                </span>
              )}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Secundario: la acción principal de la pantalla es publicar, y está en la cabecera.
              Dos botones rellenos en la misma pantalla son dos «lo más importante». */}
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              disabled={title.trim() === ''}
              onClick={save}
            >
              {t('detailsSave')}
            </Button>

            {/*
            Archivar pide confirmación en dos pasos y **no borra**: el tema sale de la lista
            de autoría y sigue existiendo para las cohortes que ya lo tienen asignado. El
            segundo paso dice eso, porque «archivar» y «borrar» se confunden.
          */}
            {archiving ? (
              <>
                <span className="type-body text-text max-w-reading">{t('archiveConfirm')}</span>
                <Button type="button" variant="secondary" loading={busy} onClick={archive}>
                  {t('archiveYes')}
                </Button>
                <Button type="button" variant="quiet" onClick={() => setArchiving(false)}>
                  {t('archiveNo')}
                </Button>
              </>
            ) : (
              <Button type="button" variant="quiet" onClick={() => setArchiving(true)}>
                {t('archive')}
              </Button>
            )}
          </div>

          {/* Eliminar de verdad (24/9): solo si nadie lo ha visto; pide escribir el título. */}
          <div className="border-border-muted border-t pt-4">
            <DeleteLessonDialog lessonId={lessonId} title={initial.title} usage={usage} />
          </div>
        </div>
      </details>
    </Card>
  );
}
