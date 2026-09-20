'use client';

/**
 * Los programas y sus módulos.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (§2).
 *
 * Vivía dentro de `/admin/institucion` junto a las asignaturas, en un componente de 547
 * líneas que no estaba en la navegación: los avisos de otras pantallas decían «se crean en
 * Institución», que es una instrucción, no un enlace.
 *
 * El orden de los módulos es por botones «subir/bajar». `reference/03-ui/accesibilidad.md:55`
 * (WCAG 2.5.7) exige una alternativa de teclado a cualquier arrastre; los botones SON esa
 * alternativa, así que son la base y el arrastre se apoya luego en el mismo endpoint.
 *
 * Nada se borra: solo se archiva, y cada acción que parece destructiva pide confirmación en
 * línea (un segundo botón) en vez de un diálogo nativo — anunciable, operable con teclado y
 * comprobable sin manejadores de diálogo.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Tooltip } from '@/components/atoms/tooltip';
import type { CurriculumProgram } from '@/features/admin/server/curriculum.service';
import { CurriculumFeedback, useCurriculumSend, type Send } from '../curriculum-send';

export function ProgramsManager({ programs }: { programs: CurriculumProgram[] }) {
  const t = useTranslations('admin.curriculum');
  const { busy, feedback, send } = useCurriculumSend();

  return (
    <div className="space-y-6">
      <CurriculumFeedback feedback={feedback} />

      {programs.length === 0 ? (
        <p className="type-body text-text-muted">{t('programsEmpty')}</p>
      ) : (
        <ul className="space-y-8">
          {programs.map((program) => (
            <li key={program.id}>
              <ProgramCard program={program} busy={busy} send={send} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgramCard({
  program,
  busy,
  send,
}: {
  program: CurriculumProgram;
  busy: boolean;
  send: Send;
}) {
  const t = useTranslations('admin.curriculum');
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const headingId = useId();

  return (
    <article
      aria-labelledby={headingId}
      className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-4 border p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="type-body-emphasis text-text">
          <span className="text-text-muted">{program.code}</span> — {program.name}
        </h3>
        <div className="flex gap-2">
          <Button variant="quiet" onClick={() => setEditing((v) => !v)} disabled={busy}>
            {editing ? t('cancel') : t('edit')}
          </Button>
          {confirmArchive ? (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  const ok = await send(
                    `/api/admin/programs/${program.id}`,
                    'PATCH',
                    { op: 'archive' },
                    t('programArchived')
                  );
                  if (ok) setConfirmArchive(false);
                }}
              >
                {t('confirmArchive')}
              </Button>
              <Button variant="quiet" onClick={() => setConfirmArchive(false)} disabled={busy}>
                {t('cancel')}
              </Button>
            </>
          ) : (
            <Button variant="quiet" onClick={() => setConfirmArchive(true)} disabled={busy}>
              {t('archive')}
            </Button>
          )}
        </div>
      </div>

      {program.description && <p className="type-caption text-text-muted">{program.description}</p>}

      {editing && (
        <ProgramForm
          initial={program}
          submitLabel={t('save')}
          busy={busy}
          onSubmit={async (values) => {
            const ok = await send(
              `/api/admin/programs/${program.id}`,
              'PATCH',
              { op: 'update', ...values },
              t('programSaved')
            );
            if (ok) setEditing(false);
          }}
        />
      )}

      <ModuleList program={program} busy={busy} send={send} />
    </article>
  );
}

interface ProgramValues {
  code: string;
  name: string;
  description: string;
  defaultAccessDays: number;
}

export function ProgramForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: CurriculumProgram;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: ProgramValues) => Promise<void>;
}) {
  const t = useTranslations('admin.curriculum');
  const [values, setValues] = useState<ProgramValues>({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    defaultAccessDays: initial?.defaultAccessDays ?? 300,
  });

  return (
    <form
      className="max-w-reading space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(values);
      }}
    >
      {/*
        El nombre va primero. Estaba en tercer lugar, detrás del código y de los días de
        acceso: se entra a este formulario a crear «Bachillerato nocturno», no a decidir unas
        siglas, y el primer campo es el que dice de qué va la pantalla.
      */}
      <FormField label={t('programName')} name="name" required>
        <FormInput
          name="name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </FormField>
      {/* El código son unos caracteres y los días un número: a ancho completo, el ojo
          recorre media pantalla entre la etiqueta y lo que hay escrito. La columna de los
          días es más ancha que la del código porque debajo lleva su explicación, y en 10rem
          esa frase caía en cuatro líneas que empujaban la fila entera. */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-40">
          <FormField label={t('programCode')} name="code" required>
            <FormInput
              name="code"
              value={values.code}
              onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
              spellCheck={false}
            />
          </FormField>
        </div>
        <div className="w-64">
          <FormField
            label={t('defaultAccessDays')}
            name="defaultAccessDays"
            required
            hint={t('defaultAccessDaysHint')}
          >
            <FormInput
              name="defaultAccessDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={3650}
              value={String(values.defaultAccessDays)}
              onChange={(e) =>
                setValues((v) => ({ ...v, defaultAccessDays: Number(e.target.value) || 0 }))
              }
            />
          </FormField>
        </div>
      </div>
      <FormField label={t('programDescription')} name="description">
        <FormInput
          name="description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        />
      </FormField>
      <Button type="submit" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

// ─────────────────────────── Modules ───────────────────────────

function ModuleList({
  program,
  busy,
  send,
}: {
  program: CurriculumProgram;
  busy: boolean;
  send: Send;
}) {
  const t = useTranslations('admin.curriculum');
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const listId = useId();

  return (
    <div className="space-y-3">
      <h4 id={listId} className="type-overline text-text-muted uppercase">
        {t('modules')}
      </h4>

      {program.modules.length === 0 ? (
        <p className="type-caption text-text-muted">{t('modulesEmpty')}</p>
      ) : (
        <ol aria-labelledby={listId} className="divide-border-muted divide-y">
          {program.modules.map((module, index) => (
            <li key={module.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="type-body text-text min-w-0 flex-1">{module.name}</span>
              {/* El recuento a la derecha, alineado con el de las demás filas. */}
              <span className="type-caption text-text-muted text-right tabular-nums">
                {t('lessonCount', { count: module.lessonCount })}
              </span>
              {/*
                La flecha es decorativa y el nombre del módulo va en un `sr-only`. Antes el
                rótulo visible era «Subir Bienvenida Valida Ya y Metodología»: la fila la
                ocupaban dos veces el título del módulo en vez del módulo. El nombre accesible
                no cambia —sigue diciendo de qué módulo se habla, que es lo que exige tener
                tres «Subir» seguidos (WCAG 2.4.6)—.
              */}
              <Tooltip label={t('moveUp')}>
                <Button
                  variant="quiet"
                  disabled={busy || index === 0}
                  onClick={() =>
                    send(
                      `/api/admin/modules/${module.id}`,
                      'PATCH',
                      { op: 'move', direction: 'up' },
                      t('moduleMoved')
                    )
                  }
                >
                  <span aria-hidden="true">↑</span>
                  <span className="sr-only">{t('moveUpNamed', { name: module.name })}</span>
                </Button>
              </Tooltip>
              <Tooltip label={t('moveDown')}>
                <Button
                  variant="quiet"
                  disabled={busy || index === program.modules.length - 1}
                  onClick={() =>
                    send(
                      `/api/admin/modules/${module.id}`,
                      'PATCH',
                      { op: 'move', direction: 'down' },
                      t('moduleMoved')
                    )
                  }
                >
                  <span aria-hidden="true">↓</span>
                  <span className="sr-only">{t('moveDownNamed', { name: module.name })}</span>
                </Button>
              </Tooltip>
              {/*
                Archivar un módulo pide confirmación igual que archivar el programa. Hasta el
                18/9 el módulo se archivaba al primer clic mientras el programa —tres líneas
                más arriba, en la misma tarjeta— pedía confirmar: la misma palabra hacía dos
                cosas distintas según dónde se pulsara.
              */}
              {confirming === module.id ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await send(
                        `/api/admin/modules/${module.id}`,
                        'PATCH',
                        { op: 'archive' },
                        t('moduleArchived')
                      );
                      if (ok) setConfirming(null);
                    }}
                  >
                    {t('confirmArchive')}
                    <span className="sr-only"> {module.name}</span>
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirming(null)} disabled={busy}>
                    {t('cancel')}
                  </Button>
                </>
              ) : (
                <Button variant="quiet" disabled={busy} onClick={() => setConfirming(module.id)}>
                  {t('archive')}
                  <span className="sr-only"> {module.name}</span>
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* La línea separa el alta de la lista y por eso va a lo ancho de la tarjeta; el
          formulario sigue limitado a `max-w-reading`, que es donde se escribe. */}
      <div className="border-border-muted border-t pt-3" />
      <form
        className="max-w-reading flex flex-wrap items-end gap-2"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send(
            '/api/admin/modules',
            'POST',
            { programId: program.id, name },
            t('moduleCreated')
          );
          if (ok) setName('');
        }}
      >
        <div className="flex-1">
          <FormField label={t('newModule')} name={`module-${program.id}`}>
            <FormInput
              name={`module-${program.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </div>
        <Button type="submit" variant="secondary" loading={busy} disabled={name.trim() === ''}>
          {t('add')}
        </Button>
      </form>
    </div>
  );
}
