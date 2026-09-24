'use client';

/**
 * Las asignaturas de la institución.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (§2).
 *
 * Una asignatura son dos campos, y se añaden varias seguidas al montar un programa: el alta
 * se queda en línea al final de la lista. Sacarla a una ruta propia sería un viaje de ida y
 * vuelta por cada una.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/atoms/card';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { DataTable } from '@/components/molecules/data-table';
import type { CurriculumSubject } from '@/features/admin/server/curriculum.service';
import { CurriculumFeedback, useCurriculumSend, type Send } from '../curriculum-send';

export function SubjectsManager({ subjects }: { subjects: CurriculumSubject[] }) {
  const t = useTranslations('admin.curriculum');
  const { busy, feedback, send } = useCurriculumSend();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <CurriculumFeedback feedback={feedback} />

      {/*
        24/9: tabla con filas expandibles (el patrón de Programas). Editar abre la fila con el
        formulario dentro; archivar confirma en línea, como en programas y módulos —hasta hoy
        aquí se archivaba al primer clic, la misma palabra con dos comportamientos—.
      */}
      <DataTable<CurriculumSubject>
        align="middle"
        compactRows
        caption={t('subjectsListTitle')}
        rows={subjects}
        rowKey={(subject) => subject.id}
        empty={<p className="type-body text-text-muted">{t('subjectsEmpty')}</p>}
        expandable={{
          isExpanded: (subject) => editing === subject.id,
          onToggle: (subject) => setEditing((prev) => (prev === subject.id ? null : subject.id)),
          label: (subject, expanded) =>
            expanded ? t('cancel') : t('editNamed', { name: subject.name }),
          content: (subject) => (
            <SubjectEditForm
              subject={subject}
              busy={busy}
              send={send}
              onDone={() => setEditing(null)}
            />
          ),
        }}
        columns={[
          {
            key: 'name',
            header: t('subjectName'),
            cell: (subject) => <span className="type-body-emphasis">{subject.name}</span>,
          },
          {
            key: 'code',
            header: t('subjectCode'),
            narrow: true,
            cell: (subject) => subject.code ?? '—',
          },
          {
            key: 'lessons',
            header: t('table.lessons'),
            numeric: true,
            narrow: true,
            cell: (subject) => subject.lessonCount,
          },
          {
            key: 'actions',
            header: t('table.actions'),
            narrow: true,
            cell: (subject) => (
              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                {confirming === subject.id ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await send(
                          `/api/admin/subjects/${subject.id}`,
                          'PATCH',
                          { op: 'archive' },
                          t('subjectArchived')
                        );
                        if (ok) setConfirming(null);
                      }}
                    >
                      {t('confirmArchive')}
                      <span className="sr-only"> {subject.name}</span>
                    </Button>
                    <Button variant="quiet" disabled={busy} onClick={() => setConfirming(null)}>
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() =>
                        setEditing((prev) => (prev === subject.id ? null : subject.id))
                      }
                    >
                      {editing === subject.id ? t('cancel') : t('edit')}
                      <span className="sr-only"> {subject.name}</span>
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() => setConfirming(subject.id)}
                    >
                      {t('archive')}
                      <span className="sr-only"> {subject.name}</span>
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* El alta tiene título propio: un formulario sin nombre es un formulario que un lector
          de pantalla encuentra y no sabe presentar. */}
      <Card title={t('newSubjectTitle')} as="h2">
        <NewSubjectForm busy={busy} send={send} />
      </Card>
    </div>
  );
}

function SubjectEditForm({
  subject,
  busy,
  send,
  onDone,
}: {
  subject: CurriculumSubject;
  busy: boolean;
  send: Send;
  onDone: () => void;
}) {
  const t = useTranslations('admin.curriculum');
  const [values, setValues] = useState({ name: subject.name, code: subject.code ?? '' });

  return (
    <form
      className="max-w-reading flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await send(
          `/api/admin/subjects/${subject.id}`,
          'PATCH',
          { op: 'update', ...values },
          t('subjectSaved')
        );
        if (ok) onDone();
      }}
    >
      <div className="flex-1">
        <FormField label={t('subjectName')} name={`subject-name-${subject.id}`} required>
          <FormInput
            name={`subject-name-${subject.id}`}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </FormField>
      </div>
      <div className="w-32">
        <FormField label={t('subjectCode')} name={`subject-code-${subject.id}`}>
          <FormInput
            name={`subject-code-${subject.id}`}
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
            spellCheck={false}
          />
        </FormField>
      </div>
      <Button type="submit" loading={busy}>
        {t('save')}
      </Button>
      <Button variant="quiet" onClick={onDone} disabled={busy}>
        {t('cancel')}
      </Button>
    </form>
  );
}

function NewSubjectForm({ busy, send }: { busy: boolean; send: Send }) {
  const t = useTranslations('admin.curriculum');
  const [values, setValues] = useState({ name: '', code: '' });

  return (
    <form
      className="max-w-reading flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await send('/api/admin/subjects', 'POST', values, t('subjectCreated'));
        if (ok) setValues({ name: '', code: '' });
      }}
    >
      <div className="flex-1">
        <FormField label={t('newSubject')} name="new-subject-name">
          <FormInput
            name="new-subject-name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </FormField>
      </div>
      <div className="w-32">
        <FormField label={t('subjectCode')} name="new-subject-code">
          <FormInput
            name="new-subject-code"
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
            spellCheck={false}
          />
        </FormField>
      </div>
      <Button type="submit" variant="secondary" loading={busy} disabled={values.name.trim() === ''}>
        {t('add')}
      </Button>
    </form>
  );
}
