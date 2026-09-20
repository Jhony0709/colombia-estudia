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
import type { CurriculumSubject } from '@/features/admin/server/curriculum.service';
import { CurriculumFeedback, useCurriculumSend, type Send } from '../curriculum-send';

export function SubjectsManager({ subjects }: { subjects: CurriculumSubject[] }) {
  const t = useTranslations('admin.curriculum');
  const { busy, feedback, send } = useCurriculumSend();

  return (
    <div className="space-y-6">
      <CurriculumFeedback feedback={feedback} />

      {subjects.length === 0 ? (
        <p className="type-body text-text-muted">{t('subjectsEmpty')}</p>
      ) : (
        <Card>
          {/*
            Las asignaturas son filas dentro de una tarjeta, no tarjetas sueltas: son todas lo
            mismo y lo que se hace con ellas es comparar cuántos temas tiene cada una. En filas
            ese número cae siempre en la misma columna (`layout-y-componentes.md` §4).
          */}
          <ul className="divide-border-muted -my-1 divide-y">
            {subjects.map((subject) => (
              <li key={subject.id} className="py-2">
                <SubjectRow subject={subject} busy={busy} send={send} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* El alta tiene título propio: un formulario sin nombre es un formulario que un lector
          de pantalla encuentra y no sabe presentar. */}
      <Card title={t('newSubjectTitle')} as="h2">
        <NewSubjectForm busy={busy} send={send} />
      </Card>
    </div>
  );
}

function SubjectRow({
  subject,
  busy,
  send,
}: {
  subject: CurriculumSubject;
  busy: boolean;
  send: Send;
}) {
  const t = useTranslations('admin.curriculum');
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name: subject.name, code: subject.code ?? '' });

  if (editing) {
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
          if (ok) setEditing(false);
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
        <Button variant="quiet" onClick={() => setEditing(false)} disabled={busy}>
          {t('cancel')}
        </Button>
      </form>
    );
  }

  /*
    El nombre de la asignatura va en un `sr-only` DENTRO del botón, no como texto visible.
    Antes la etiqueta era «Editar Inducción Valida YA!» y se pintaba entera: dos botones con
    el título largo repetido en cada fila, que en móvil ocupan tres líneas cada uno. El
    nombre accesible sigue siendo único —WCAG 2.4.6, y con varias filas «Editar» a secas es
    ambiguo—, pero el ojo lee «Editar» y «Archivar».
  */
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="type-body text-text min-w-0 flex-1">
        {subject.name}
        {subject.code && <span className="text-text-muted ml-2">({subject.code})</span>}
      </span>
      {/* El recuento a la derecha y no pegado al nombre: así los de todas las filas se leen
          en vertical de una pasada, que es la única razón para ponerlos juntos. */}
      <span className="type-caption text-text-muted text-right tabular-nums">
        {t('lessonCount', { count: subject.lessonCount })}
      </span>
      <Button variant="quiet" onClick={() => setEditing(true)} disabled={busy}>
        {t('edit')}
        <span className="sr-only"> {subject.name}</span>
      </Button>
      <Button
        variant="quiet"
        disabled={busy}
        onClick={() =>
          send(
            `/api/admin/subjects/${subject.id}`,
            'PATCH',
            { op: 'archive' },
            t('subjectArchived')
          )
        }
      >
        {t('archive')}
        <span className="sr-only"> {subject.name}</span>
      </Button>
    </div>
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
